"""DynamoDB implementation of the platform Store (see src/store_base.py).

Tables (infra/terraform): readings, platform, audit. All have string keys pk and sk.

readings  METER#<id> / <ts>          meter reading        (ts = ISO timestamp, naive WAT)
          FEEDER#<id> / <ts>         feeder reading
          CONFLICT#<kind>#<id> / ... a rejected re-send of an existing reading
platform  REGISTRY / FEEDER#<id>     feeder and its band
          REGISTRY / METER#<id>      meter and its feeder
          FLAG#<key> / FLAG          flag (gsi1: STATUS#<status>); key = hash of rule, subject, period
          USER#<name> / PROFILE      user
          SESSION#<hash> / SESSION   session (ttl attribute clears expired ones lazily)
          META / CONFLICTS           counter of ingest conflicts
          META / READING_RANGE       earliest and latest feeder reading
audit     LOG / <12-digit seq>       hash-chained audit entry
          META / HEAD                latest seq and hash, advanced in the same transaction as each entry

Timestamps are naive WAT, the same convention as the rest of the app.
Reserved-word safety: every attribute used inside an expression string is aliased with #names,
because DynamoDB has a long reserved-word list (STATUS, HASH and others) that moto does not enforce.
"""
from __future__ import annotations

import hashlib
import json
import threading
import time
import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from decimal import Decimal
from typing import Iterable, Optional

import boto3
from boto3.dynamodb.conditions import Key
from botocore.exceptions import ClientError

from src.clock import WAT, now_wat_iso
from src.ingest.validate import FeederReading, MeterReading, Reading
from src.store import GENESIS_HASH, TELEMETRY_SOURCES, IngestResult

FLAG_STATUSES = ("open", "investigating", "confirmed", "dismissed")
MAX_AUDIT_RETRIES = 10


def _now() -> str:
    return now_wat_iso()


def _dec(value: Optional[float]) -> Optional[Decimal]:
    return None if value is None else Decimal(str(value))


def _float(value) -> Optional[float]:
    return None if value is None else float(value)


def _code(err: ClientError) -> str:
    return err.response["Error"]["Code"]


FEEDER_METADATA_FIELDS = (
    "source_feeder_name", "disco", "state", "business_unit", "monthly_energy_cap_kwh", "data_type", "source_url",
)


def _feeder_metadata(metadata: dict) -> dict:
    """Only the known fields, numbers as Decimal (DynamoDB refuses floats), unset fields left out."""
    clean = {}
    for field in FEEDER_METADATA_FIELDS:
        value = metadata.get(field)
        if value is not None:
            clean[field] = _dec(value) if field == "monthly_energy_cap_kwh" else value
    clean.setdefault("data_type", "unknown")
    return clean


def _audit_hash(prev_hash: str, at: str, actor: str, action: str, target: str, details: str) -> str:
    payload = json.dumps([prev_hash, at, actor, action, target, details])
    return hashlib.sha256(payload.encode()).hexdigest()


def _flag_key(f: dict) -> str:
    """Deterministic id for a flag: the same rule, subject and period always give the same key."""
    parts = [f["rule"], f["subject_type"], f["subject_id"], f["period_start"], f["period_end"]]
    return hashlib.sha256("|".join(parts).encode()).hexdigest()[:32]


class DynamoDBStore:
    def __init__(
        self,
        readings_table: str,
        platform_table: str,
        audit_table: str,
        region_name: Optional[str] = None,
        resource=None,
        allow_reset: bool = False,
    ):
        self._ddb = resource or boto3.session.Session().resource("dynamodb", region_name=region_name)  # own session: not shared
        self._client = self._ddb.meta.client
        self._allow_reset = allow_reset
        self._audit_name = audit_table
        self.readings = self._ddb.Table(readings_table)
        self.platform = self._ddb.Table(platform_table)
        self.audit_table = self._ddb.Table(audit_table)

    # Lifecycle

    def close(self) -> None:
        pass

    def reset(self) -> None:
        """Delete every item in all three tables. Demo and test use only, so it must be asked for."""
        if not self._allow_reset:
            raise RuntimeError("reset() is disabled on this store; construct it with allow_reset=True (tests and demos only)")
        for table in (self.readings, self.platform, self.audit_table):
            keys = [{"pk": i["pk"], "sk": i["sk"]} for i in self._scan_all(table, ProjectionExpression="pk, sk")]
            with table.batch_writer() as batch:
                for key in keys:
                    batch.delete_item(Key=key)

    # Helpers

    @staticmethod
    def _query_all(table, **kwargs) -> list[dict]:
        items: list[dict] = []
        while True:
            page = table.query(**kwargs)
            items += page["Items"]
            if "LastEvaluatedKey" not in page:
                return items
            kwargs["ExclusiveStartKey"] = page["LastEvaluatedKey"]

    @staticmethod
    def _scan_all(table, **kwargs) -> list[dict]:
        items: list[dict] = []
        while True:
            page = table.scan(**kwargs)
            items += page["Items"]
            if "LastEvaluatedKey" not in page:
                return items
            kwargs["ExclusiveStartKey"] = page["LastEvaluatedKey"]

    def _get(self, table, pk: str, sk: str) -> Optional[dict]:
        return table.get_item(Key={"pk": pk, "sk": sk}, ConsistentRead=True).get("Item")

    # Registry

    def upsert_feeder(self, feeder_id: str, band: str, metadata: Optional[dict] = None) -> None:
        """Create or update a feeder. Without metadata, any stored metadata is kept (as in SQLite).
        With metadata, it replaces the stored metadata completely."""
        names = {"#f": "feeder_id", "#b": "band"}
        values = {":f": feeder_id, ":b": band}
        expression = "SET #f = :f, #b = :b"
        if metadata is not None:
            names["#m"] = "metadata"
            values[":m"] = _feeder_metadata(metadata)
            expression += ", #m = :m"
        self.platform.update_item(
            Key={"pk": "REGISTRY", "sk": f"FEEDER#{feeder_id}"},
            UpdateExpression=expression,
            ExpressionAttributeNames=names,
            ExpressionAttributeValues=values,
        )

    def feeder_details(self, feeder_id: str) -> Optional[dict]:
        """The feeder, its band and its official metadata, in the same shape SQLite returns."""
        item = self._get(self.platform, "REGISTRY", f"FEEDER#{feeder_id}")
        if not item:
            return None
        stored = item.get("metadata", {})
        details = {"feeder_id": item["feeder_id"], "band": item["band"]}
        for field in FEEDER_METADATA_FIELDS:
            details[field] = stored.get(field)
        details["monthly_energy_cap_kwh"] = _float(details["monthly_energy_cap_kwh"])
        details["data_type"] = stored.get("data_type", "unknown")
        details["feeder_telemetry_source"] = item.get("feeder_telemetry_source", "unknown")
        details["meter_telemetry_source"] = item.get("meter_telemetry_source", "unknown")
        return details

    def set_telemetry_sources(self, feeder_id: str, feeder_source: Optional[str] = None, meter_source: Optional[str] = None) -> None:
        """Say where a feeder's readings and its meters' readings come from. Only the given values change."""
        for value in (feeder_source, meter_source):
            if value is not None and value not in TELEMETRY_SOURCES:
                raise ValueError(f"telemetry source must be one of {TELEMETRY_SOURCES}, got {value!r}")
        names, values, parts = {}, {}, []
        for placeholder, attribute, value in (("#f", "feeder_telemetry_source", feeder_source), ("#m", "meter_telemetry_source", meter_source)):
            if value is not None:
                names[placeholder], values[f":{placeholder[1]}"] = attribute, value
                parts.append(f"{placeholder} = :{placeholder[1]}")
        if not parts:
            if self.feeder_band(feeder_id) is None:
                raise KeyError(f"unknown feeder {feeder_id!r}")
            return
        try:
            self.platform.update_item(
                Key={"pk": "REGISTRY", "sk": f"FEEDER#{feeder_id}"},
                UpdateExpression="SET " + ", ".join(parts),
                ConditionExpression="attribute_exists(pk)",
                ExpressionAttributeNames=names,
                ExpressionAttributeValues=values,
            )
        except ClientError as err:
            if _code(err) == "ConditionalCheckFailedException":
                raise KeyError(f"unknown feeder {feeder_id!r}") from err
            raise

    def upsert_meter(self, meter_id: str, feeder_id: str) -> None:
        self.platform.put_item(Item={"pk": "REGISTRY", "sk": f"METER#{meter_id}", "meter_id": meter_id, "feeder_id": feeder_id})

    def _registry(self, prefix: str) -> list[dict]:
        return self._query_all(
            self.platform,
            KeyConditionExpression=Key("pk").eq("REGISTRY") & Key("sk").begins_with(prefix),
            ConsistentRead=True,
        )

    def feeders(self) -> list[dict]:
        return [{"feeder_id": i["feeder_id"], "band": i["band"]} for i in self._registry("FEEDER#")]

    def feeder_band(self, feeder_id: str) -> Optional[str]:
        item = self._get(self.platform, "REGISTRY", f"FEEDER#{feeder_id}")
        return item["band"] if item else None

    def meter_feeder(self, meter_id: str) -> Optional[str]:
        item = self._get(self.platform, "REGISTRY", f"METER#{meter_id}")
        return item["feeder_id"] if item else None

    def meter_ids(self, feeder_id: Optional[str] = None) -> list[str]:
        items = self._registry("METER#")
        return [i["meter_id"] for i in items if feeder_id is None or i["feeder_id"] == feeder_id]

    def reading_range(self) -> Optional[tuple[datetime, datetime]]:
        item = self._get(self.platform, "META", "READING_RANGE")
        if not item:
            return None
        return datetime.fromisoformat(item["min_ts"]), datetime.fromisoformat(item["max_ts"])

    def _widen_range(self, low: str, high: str) -> None:
        key = {"pk": "META", "sk": "READING_RANGE"}
        updates = (
            ("min_ts", low, "attribute_not_exists(#a) OR #a > :v"),
            ("max_ts", high, "attribute_not_exists(#a) OR #a < :v"),
        )
        for attr, value, condition in updates:
            try:
                self.platform.update_item(
                    Key=key,
                    UpdateExpression="SET #a = :v",
                    ConditionExpression=condition,
                    ExpressionAttributeNames={"#a": attr},
                    ExpressionAttributeValues={":v": value},
                )
            except ClientError as err:
                if _code(err) != "ConditionalCheckFailedException":
                    raise

    # Readings

    @staticmethod
    def _reading_item(r: Reading, received_at: str):
        """How a reading is stored. The one definition, shared by save() and bulk_load().

        Returns (kind, source_id, item, comparable values, conflict payload)."""
        ts = r.timestamp.isoformat()
        if isinstance(r, MeterReading):
            item = {"pk": f"METER#{r.meter_id}", "sk": ts, "kwh": _dec(r.kwh), "tamper": bool(r.tamper), "received_at": received_at}
            if r.voltage is not None:
                item["voltage"] = _dec(r.voltage)
            return "meter", r.meter_id, item, (r.kwh, r.voltage, bool(r.tamper)), {"kwh": r.kwh, "voltage": r.voltage, "tamper": int(r.tamper)}
        item = {"pk": f"FEEDER#{r.feeder_id}", "sk": ts, "voltage": _dec(r.voltage), "received_at": received_at}
        if r.kwh is not None:
            item["kwh"] = _dec(r.kwh)
        return "feeder", r.feeder_id, item, (r.voltage, r.kwh), {"voltage": r.voltage, "kwh": r.kwh}

    def bulk_load(self, readings: Iterable[Reading], workers: int = 1, progress=None) -> int:
        """Write many readings fast with BatchWriteItem (25 per request, several requests at once).

        FOR SEEDING EMPTY TABLES ONLY. Unlike save(), it does not detect duplicates or conflicts:
        a reading with an existing key silently replaces it. Returns the number written."""
        received_at = _now()
        region = self._client.meta.region_name
        local = threading.local()

        def table():  # boto3 resources are not thread-safe, so each worker thread gets its own
            if not hasattr(local, "table"):
                local.table = boto3.session.Session().resource("dynamodb", region_name=region).Table(self.readings.name)
            return local.table

        def write(items: list[dict]) -> int:
            with table().batch_writer(overwrite_by_pkeys=["pk", "sk"]) as batch:
                for item in items:
                    batch.put_item(Item=item)
            return len(items)

        low: Optional[str] = None
        high: Optional[str] = None
        written, pending, chunk = 0, [], []
        with ThreadPoolExecutor(max_workers=max(1, workers)) as pool:
            def flush():
                nonlocal chunk
                if chunk:
                    pending.append(pool.submit(write, chunk))
                    chunk = []

            def drain(limit: int):
                nonlocal written
                while len(pending) > limit:
                    written += pending.pop(0).result()
                    if progress:
                        progress(written)

            for r in readings:
                kind, _, item, _, _ = self._reading_item(r, received_at)
                chunk.append(item)
                if kind == "feeder":
                    ts = item["sk"]
                    low = ts if low is None or ts < low else low
                    high = ts if high is None or ts > high else high
                if len(chunk) >= 250:
                    flush()
                    drain(workers * 2)  # keeps memory bounded on large files
            flush()
            drain(0)
        if low is not None and high is not None:
            self._widen_range(low, high)
        return written

    def save(self, readings: Iterable[Reading], result: Optional[IngestResult] = None) -> IngestResult:
        """Insert validated readings idempotently. Safe to replay and order-independent."""
        result = result or IngestResult()
        received_at = _now()
        feeder_low: Optional[str] = None
        feeder_high: Optional[str] = None
        for r in readings:
            kind, source_id, item, new, payload = self._reading_item(r, received_at)
            ts = item["sk"]
            try:
                self.readings.put_item(Item=item, ConditionExpression="attribute_not_exists(pk)")
            except ClientError as err:
                if _code(err) != "ConditionalCheckFailedException":
                    raise
                existing = self._get(self.readings, item["pk"], ts)
                stored = (
                    (float(existing["kwh"]), _float(existing.get("voltage")), bool(existing["tamper"]))
                    if kind == "meter"
                    else (float(existing["voltage"]), _float(existing.get("kwh")))
                )
                if stored == new:
                    result.duplicates += 1
                else:
                    result.conflicts += 1
                    self._record_conflict(kind, source_id, ts, payload, received_at)
                continue
            result.accepted += 1
            if kind == "feeder":
                feeder_low = ts if feeder_low is None or ts < feeder_low else feeder_low
                feeder_high = ts if feeder_high is None or ts > feeder_high else feeder_high
        if feeder_low is not None and feeder_high is not None:
            self._widen_range(feeder_low, feeder_high)
        return result

    def _record_conflict(self, kind: str, source_id: str, ts: str, payload: dict, received_at: str) -> None:
        self.readings.put_item(
            Item={
                "pk": f"CONFLICT#{kind}#{source_id}",
                "sk": f"{ts}#{received_at}#{uuid.uuid4().hex[:8]}",
                "payload": json.dumps(payload),
                "received_at": received_at,
            }
        )
        self.platform.update_item(
            Key={"pk": "META", "sk": "CONFLICTS"},
            UpdateExpression="ADD #n :one",
            ExpressionAttributeNames={"#n": "n"},
            ExpressionAttributeValues={":one": 1},
        )

    def _range(self, pk: str, start: datetime, end: datetime) -> list[dict]:
        """Items with start <= ts < end, in time order. BETWEEN is inclusive, so drop the end."""
        low, high = start.isoformat(), end.isoformat()
        if low >= high:
            return []
        items = self._query_all(
            self.readings,
            KeyConditionExpression=Key("pk").eq(pk) & Key("sk").between(low, high),
            ConsistentRead=True,
        )
        return [i for i in items if i["sk"] < high]

    def feeder_samples(self, feeder_id: str, start: datetime, end: datetime) -> list[tuple[datetime, float]]:
        return [(r.timestamp, r.voltage) for r in self.feeder_readings(feeder_id, start, end)]

    def feeder_readings(self, feeder_id: str, start: datetime, end: datetime) -> list[FeederReading]:
        return [
            FeederReading(feeder_id, datetime.fromisoformat(i["sk"]), float(i["voltage"]), _float(i.get("kwh")))
            for i in self._range(f"FEEDER#{feeder_id}", start, end)
        ]

    def meter_readings(self, meter_id: str, start: datetime, end: datetime) -> list[MeterReading]:
        return [
            MeterReading(meter_id, datetime.fromisoformat(i["sk"]), float(i["kwh"]), _float(i.get("voltage")), bool(i["tamper"]))
            for i in self._range(f"METER#{meter_id}", start, end)
        ]

    def conflict_count(self) -> int:
        item = self._get(self.platform, "META", "CONFLICTS")
        return int(item["n"]) if item else 0

    # Flags

    @staticmethod
    def _flag_view(item: dict) -> dict:
        return {
            "flag_id": item["flag_id"],
            "rule": item["rule"],
            "subject_type": item["subject_type"],
            "subject_id": item["subject_id"],
            "feeder_id": item["feeder_id"],
            "period_start": item["period_start"],
            "period_end": item["period_end"],
            "reason": item["reason"],
            "confidence": float(item["confidence"]),
            "evidence": json.loads(item["evidence"]),
            "status": item["status"],
            "decided_by": item.get("decided_by"),
            "decided_at": item.get("decided_at"),
            "decision_note": item.get("decision_note"),
            "created_at": item["created_at"],
        }

    def save_flags(self, flags: Iterable[dict]) -> int:
        """Insert new flags; a flag already raised for the same rule, subject and period is kept as is."""
        created = 0
        base = time.time_ns()
        for i, f in enumerate(flags):
            key = _flag_key(f)
            order = f"{base:020d}-{i:04d}"  # creation order, kept stable within one call
            item = {
                "pk": f"FLAG#{key}", "sk": "FLAG", "flag_id": key, "order": order,
                "rule": f["rule"], "subject_type": f["subject_type"], "subject_id": f["subject_id"],
                "feeder_id": f["feeder_id"], "period_start": f["period_start"], "period_end": f["period_end"],
                "reason": f["reason"], "confidence": _dec(f["confidence"]), "evidence": json.dumps(f["evidence"]),
                "status": "open", "created_at": _now(), "gsi1pk": "STATUS#open", "gsi1sk": order,
            }
            try:
                self.platform.put_item(Item=item, ConditionExpression="attribute_not_exists(pk)")
                created += 1
            except ClientError as err:
                if _code(err) != "ConditionalCheckFailedException":
                    raise
        return created

    def flags(self, status: Optional[str] = None, feeder_id: Optional[str] = None) -> list[dict]:
        """Highest confidence first, then oldest first. Reads the status index, which is eventually consistent."""
        items: list[dict] = []
        for s in [status] if status else FLAG_STATUSES:
            items += self._query_all(self.platform, IndexName="gsi1", KeyConditionExpression=Key("gsi1pk").eq(f"STATUS#{s}"))
        if feeder_id:
            items = [i for i in items if i["feeder_id"] == feeder_id]
        items.sort(key=lambda i: (-float(i["confidence"]), i["order"]))
        return [self._flag_view(i) for i in items]

    def flag(self, flag_id) -> Optional[dict]:
        item = self._get(self.platform, f"FLAG#{flag_id}", "FLAG")
        return self._flag_view(item) if item else None

    def decide_flags(self, flag_ids: list, status: str, actor: str, note: str) -> None:
        decided_at = _now()
        for flag_id in flag_ids:
            try:
                self.platform.update_item(
                    Key={"pk": f"FLAG#{flag_id}", "sk": "FLAG"},
                    UpdateExpression="SET #st = :s, #by = :b, #at = :t, #note = :n, #g = :g",
                    ConditionExpression="attribute_exists(pk)",
                    ExpressionAttributeNames={
                        "#st": "status", "#by": "decided_by", "#at": "decided_at", "#note": "decision_note", "#g": "gsi1pk",
                    },
                    ExpressionAttributeValues={":s": status, ":b": actor, ":t": decided_at, ":n": note, ":g": f"STATUS#{status}"},
                )
            except ClientError as err:
                if _code(err) != "ConditionalCheckFailedException":  # an unknown id is skipped, as in SQLite
                    raise

    # Users and sessions

    def add_user(self, username: str, password_hash: str, role: str, display_name: str, meter_id: Optional[str] = None) -> None:
        item = {
            "pk": f"USER#{username}", "sk": "PROFILE", "username": username,
            "password_hash": password_hash, "role": role, "display_name": display_name,
        }
        if meter_id is not None:
            item["meter_id"] = meter_id
        self.platform.put_item(Item=item)

    def user(self, username: str) -> Optional[dict]:
        item = self._get(self.platform, f"USER#{username}", "PROFILE")
        if not item:
            return None
        return {
            "username": item["username"], "password_hash": item["password_hash"], "role": item["role"],
            "meter_id": item.get("meter_id"), "display_name": item["display_name"],
        }

    def add_session(self, token_hash: str, username: str, expires_at: datetime) -> None:
        self.platform.put_item(
            Item={
                "pk": f"SESSION#{token_hash}", "sk": "SESSION", "username": username,
                "expires_at": expires_at.isoformat(),
                "ttl": int(expires_at.replace(tzinfo=WAT).timestamp()),
            }
        )

    def session_user(self, token_hash: str, now: datetime) -> Optional[dict]:
        item = self._get(self.platform, f"SESSION#{token_hash}", "SESSION")
        # TTL deletion is lazy (can take a day or more), so expiry is always checked here.
        if not item or not item["expires_at"] > now.isoformat():
            return None
        return self.user(item["username"])

    def delete_session(self, token_hash: str) -> None:
        self.platform.delete_item(Key={"pk": f"SESSION#{token_hash}", "sk": "SESSION"})

    # Audit log

    def audit(self, actor: str, action: str, target: str, details: Optional[dict] = None) -> None:
        """Append one entry and advance HEAD in a single transaction, retrying if another writer got there first."""
        at, details_json = _now(), json.dumps(details or {}, sort_keys=True)
        for _ in range(MAX_AUDIT_RETRIES):
            head = self._get(self.audit_table, "META", "HEAD")
            prev = head["hash"] if head else GENESIS_HASH
            seq = int(head["seq"]) + 1 if head else 1
            entry_hash = _audit_hash(prev, at, actor, action, target, details_json)
            entry = {
                "pk": "LOG", "sk": f"{seq:012d}", "seq": seq, "at": at, "actor": actor, "action": action,
                "target": target, "details": details_json, "prev_hash": prev, "hash": entry_hash,
            }
            new_head = {"pk": "META", "sk": "HEAD", "seq": seq, "hash": entry_hash}
            head_put: dict = {"TableName": self._audit_name, "Item": new_head}
            if head:
                head_put.update(
                    ConditionExpression="#s = :old",
                    ExpressionAttributeNames={"#s": "seq"},
                    ExpressionAttributeValues={":old": int(head["seq"])},
                )
            else:
                head_put["ConditionExpression"] = "attribute_not_exists(pk)"
            try:
                self._client.transact_write_items(
                    TransactItems=[
                        {"Put": {"TableName": self._audit_name, "Item": entry, "ConditionExpression": "attribute_not_exists(pk)"}},
                        {"Put": head_put},
                    ]
                )
                return
            except ClientError as err:
                if _code(err) != "TransactionCanceledException":
                    raise
        raise RuntimeError("could not append to the audit log: too many concurrent writers")

    @staticmethod
    def _entry_view(item: dict) -> dict:
        return {
            "seq": int(item["seq"]), "at": item["at"], "actor": item["actor"], "action": item["action"],
            "target": item["target"], "details": json.loads(item["details"]),
            "prev_hash": item["prev_hash"], "hash": item["hash"],
        }

    def audit_entries(self, limit: int = 200) -> list[dict]:
        page = self.audit_table.query(KeyConditionExpression=Key("pk").eq("LOG"), ScanIndexForward=False, Limit=limit, ConsistentRead=True)
        return [self._entry_view(i) for i in page["Items"]]

    def verify_audit_chain(self) -> Optional[int]:
        """Return the seq of the first broken or missing entry, or None if the chain is intact."""
        prev, last_seq = GENESIS_HASH, 0
        for item in self._query_all(self.audit_table, KeyConditionExpression=Key("pk").eq("LOG"), ConsistentRead=True):
            seq = int(item["seq"])
            expected = _audit_hash(prev, item["at"], item["actor"], item["action"], item["target"], item["details"])
            if seq != last_seq + 1 or item["prev_hash"] != prev or item["hash"] != expected:
                return seq
            prev, last_seq = item["hash"], seq
        head = self._get(self.audit_table, "META", "HEAD")
        if (head["hash"] if head else GENESIS_HASH) != prev or (int(head["seq"]) if head else 0) != last_seq:
            return last_seq + 1  # entries were removed from the end of the log
        return None
