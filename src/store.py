"""Platform store. SQLite for local runs and the demo; the DynamoDB store will share this interface."""
from __future__ import annotations

import hashlib
import json
import sqlite3
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Iterable, Optional, Union

from src.clock import now_wat_iso
from src.ingest.validate import FeederReading, MeterReading, Reading

SCHEMA = """
CREATE TABLE IF NOT EXISTS feeders (
    feeder_id TEXT PRIMARY KEY,
    band TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS meters (
    meter_id TEXT PRIMARY KEY,
    feeder_id TEXT NOT NULL REFERENCES feeders(feeder_id)
);
CREATE TABLE IF NOT EXISTS meter_readings (
    meter_id TEXT NOT NULL,
    ts TEXT NOT NULL,
    kwh REAL NOT NULL,
    voltage REAL,
    tamper INTEGER NOT NULL,
    received_at TEXT NOT NULL,
    PRIMARY KEY (meter_id, ts)
);
CREATE TABLE IF NOT EXISTS feeder_readings (
    feeder_id TEXT NOT NULL,
    ts TEXT NOT NULL,
    voltage REAL NOT NULL,
    kwh REAL,
    received_at TEXT NOT NULL,
    PRIMARY KEY (feeder_id, ts)
);
-- A reading that reuses an existing (id, timestamp) with different values. The first
-- value is kept; the later one is recorded here so nothing is silently dropped.
CREATE TABLE IF NOT EXISTS ingest_conflicts (
    kind TEXT NOT NULL,
    source_id TEXT NOT NULL,
    ts TEXT NOT NULL,
    payload TEXT NOT NULL,
    received_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS flags (
    flag_id INTEGER PRIMARY KEY AUTOINCREMENT,
    rule TEXT NOT NULL,
    subject_type TEXT NOT NULL,
    subject_id TEXT NOT NULL,
    feeder_id TEXT NOT NULL,
    period_start TEXT NOT NULL,
    period_end TEXT NOT NULL,
    reason TEXT NOT NULL,
    confidence REAL NOT NULL,
    evidence TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open',
    decided_by TEXT,
    decided_at TEXT,
    decision_note TEXT,
    created_at TEXT NOT NULL,
    UNIQUE (rule, subject_type, subject_id, period_start, period_end)
);
CREATE TABLE IF NOT EXISTS users (
    username TEXT PRIMARY KEY,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL,
    meter_id TEXT,
    display_name TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    username TEXT NOT NULL REFERENCES users(username),
    expires_at TEXT NOT NULL
);
-- Append-only. Each entry hashes the previous one, so edits or deletions break the chain.
CREATE TABLE IF NOT EXISTS audit_log (
    seq INTEGER PRIMARY KEY AUTOINCREMENT,
    at TEXT NOT NULL,
    actor TEXT NOT NULL,
    action TEXT NOT NULL,
    target TEXT NOT NULL,
    details TEXT NOT NULL,
    prev_hash TEXT NOT NULL,
    hash TEXT NOT NULL
);
CREATE TRIGGER IF NOT EXISTS audit_no_update BEFORE UPDATE ON audit_log
BEGIN SELECT RAISE(ABORT, 'audit_log is append-only'); END;
CREATE TRIGGER IF NOT EXISTS audit_no_delete BEFORE DELETE ON audit_log
BEGIN SELECT RAISE(ABORT, 'audit_log is append-only'); END;
"""

GENESIS_HASH = "0" * 64


def _now() -> str:
    return now_wat_iso()


@dataclass
class IngestResult:
    accepted: int = 0
    duplicates: int = 0
    conflicts: int = 0
    rejected: list[dict] = field(default_factory=list)  # {"index": i, "errors": [...]}

    def as_dict(self) -> dict:
        return {
            "accepted": self.accepted,
            "duplicates": self.duplicates,
            "conflicts": self.conflicts,
            "rejected": self.rejected,
        }


class SQLiteStore:
    def __init__(self, path: Union[str, Path] = ":memory:"):
        self.conn = sqlite3.connect(str(path), check_same_thread=False)
        self.conn.row_factory = sqlite3.Row
        self.conn.executescript(SCHEMA)

    def close(self) -> None:
        self.conn.close()

    def reset(self) -> None:
        """Drop every table and recreate the schema in place. Unlike deleting the file, this
        works while another process (such as the running API) has the database open."""
        tables = [
            r[0] for r in self.conn.execute("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
        ]
        with self.conn:
            for table in tables:
                self.conn.execute(f'DROP TABLE "{table}"')  # also drops its triggers
        self.conn.executescript(SCHEMA)

    # Registry

    def upsert_feeder(self, feeder_id: str, band: str) -> None:
        with self.conn:
            self.conn.execute(
                "INSERT INTO feeders VALUES (?, ?) ON CONFLICT(feeder_id) DO UPDATE SET band = excluded.band",
                (feeder_id, band),
            )

    def upsert_meter(self, meter_id: str, feeder_id: str) -> None:
        with self.conn:
            self.conn.execute(
                "INSERT INTO meters VALUES (?, ?) ON CONFLICT(meter_id) DO UPDATE SET feeder_id = excluded.feeder_id",
                (meter_id, feeder_id),
            )

    def feeders(self) -> list[dict]:
        return [dict(r) for r in self.conn.execute("SELECT feeder_id, band FROM feeders ORDER BY feeder_id")]

    def feeder_band(self, feeder_id: str) -> Optional[str]:
        row = self.conn.execute("SELECT band FROM feeders WHERE feeder_id = ?", (feeder_id,)).fetchone()
        return row[0] if row else None

    def meter_feeder(self, meter_id: str) -> Optional[str]:
        row = self.conn.execute("SELECT feeder_id FROM meters WHERE meter_id = ?", (meter_id,)).fetchone()
        return row[0] if row else None

    def meter_ids(self, feeder_id: Optional[str] = None) -> list[str]:
        if feeder_id is None:
            rows = self.conn.execute("SELECT meter_id FROM meters ORDER BY meter_id")
        else:
            rows = self.conn.execute("SELECT meter_id FROM meters WHERE feeder_id = ? ORDER BY meter_id", (feeder_id,))
        return [r[0] for r in rows]

    def reading_range(self) -> Optional[tuple[datetime, datetime]]:
        row = self.conn.execute("SELECT MIN(ts), MAX(ts) FROM feeder_readings").fetchone()
        return (datetime.fromisoformat(row[0]), datetime.fromisoformat(row[1])) if row[0] else None

    # Readings

    def save(self, readings: Iterable[Reading], result: Optional[IngestResult] = None) -> IngestResult:
        """Insert validated readings idempotently. Safe to replay and order-independent."""
        result = result or IngestResult()
        received_at = _now()
        with self.conn:
            for r in readings:
                if isinstance(r, MeterReading):
                    kind, source_id = "meter", r.meter_id
                    table, key_col = "meter_readings", "meter_id"
                    values = {"kwh": r.kwh, "voltage": r.voltage, "tamper": int(r.tamper)}
                else:
                    kind, source_id = "feeder", r.feeder_id
                    table, key_col = "feeder_readings", "feeder_id"
                    values = {"voltage": r.voltage, "kwh": r.kwh}
                ts = r.timestamp.isoformat()
                cols = ", ".join(values)
                inserted = self.conn.execute(
                    f"INSERT OR IGNORE INTO {table} ({key_col}, ts, {cols}, received_at) "
                    f"VALUES (?, ?, {', '.join('?' * len(values))}, ?)",
                    (source_id, ts, *values.values(), received_at),
                ).rowcount
                if inserted:
                    result.accepted += 1
                    continue
                existing = self.conn.execute(
                    f"SELECT {cols} FROM {table} WHERE {key_col} = ? AND ts = ?", (source_id, ts)
                ).fetchone()
                if tuple(existing) == tuple(values.values()):
                    result.duplicates += 1
                else:
                    result.conflicts += 1
                    self.conn.execute(
                        "INSERT INTO ingest_conflicts VALUES (?, ?, ?, ?, ?)",
                        (kind, source_id, ts, json.dumps(values), received_at),
                    )
        return result

    def feeder_samples(self, feeder_id: str, start: datetime, end: datetime) -> list[tuple[datetime, float]]:
        """(timestamp, voltage) for start <= ts < end, in time order."""
        return [(r.timestamp, r.voltage) for r in self.feeder_readings(feeder_id, start, end)]

    def feeder_readings(self, feeder_id: str, start: datetime, end: datetime) -> list[FeederReading]:
        rows = self.conn.execute(
            "SELECT ts, voltage, kwh FROM feeder_readings WHERE feeder_id = ? AND ts >= ? AND ts < ? ORDER BY ts",
            (feeder_id, start.isoformat(), end.isoformat()),
        )
        return [FeederReading(feeder_id, datetime.fromisoformat(ts), v, kwh) for ts, v, kwh in rows]

    def meter_readings(self, meter_id: str, start: datetime, end: datetime) -> list[MeterReading]:
        rows = self.conn.execute(
            "SELECT ts, kwh, voltage, tamper FROM meter_readings WHERE meter_id = ? AND ts >= ? AND ts < ? ORDER BY ts",
            (meter_id, start.isoformat(), end.isoformat()),
        )
        return [MeterReading(meter_id, datetime.fromisoformat(ts), kwh, v, bool(t)) for ts, kwh, v, t in rows]

    def conflict_count(self) -> int:
        return self.conn.execute("SELECT COUNT(*) FROM ingest_conflicts").fetchone()[0]

    # Flags

    def save_flags(self, flags: Iterable[dict]) -> int:
        """Insert new flags; a flag already raised for the same rule, subject and period is kept as is."""
        created = 0
        with self.conn:
            for f in flags:
                created += self.conn.execute(
                    "INSERT OR IGNORE INTO flags (rule, subject_type, subject_id, feeder_id, period_start, period_end, "
                    "reason, confidence, evidence, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                    (
                        f["rule"], f["subject_type"], f["subject_id"], f["feeder_id"],
                        f["period_start"], f["period_end"], f["reason"], f["confidence"],
                        json.dumps(f["evidence"]), _now(),
                    ),
                ).rowcount
        return created

    def flags(self, status: Optional[str] = None, feeder_id: Optional[str] = None) -> list[dict]:
        sql, args = "SELECT * FROM flags WHERE 1=1", []
        if status:
            sql, args = sql + " AND status = ?", args + [status]
        if feeder_id:
            sql, args = sql + " AND feeder_id = ?", args + [feeder_id]
        rows = self.conn.execute(sql + " ORDER BY confidence DESC, flag_id", args)
        return [{**dict(r), "evidence": json.loads(r["evidence"])} for r in rows]

    def flag(self, flag_id: int) -> Optional[dict]:
        row = self.conn.execute("SELECT * FROM flags WHERE flag_id = ?", (flag_id,)).fetchone()
        return {**dict(row), "evidence": json.loads(row["evidence"])} if row else None

    def decide_flags(self, flag_ids: list[int], status: str, actor: str, note: str) -> None:
        with self.conn:
            self.conn.executemany(
                "UPDATE flags SET status = ?, decided_by = ?, decided_at = ?, decision_note = ? WHERE flag_id = ?",
                [(status, actor, _now(), note, flag_id) for flag_id in flag_ids],
            )

    # Users and sessions

    def add_user(self, username: str, password_hash: str, role: str, display_name: str, meter_id: Optional[str] = None) -> None:
        with self.conn:
            self.conn.execute(
                "INSERT INTO users VALUES (?, ?, ?, ?, ?) ON CONFLICT(username) DO UPDATE SET "
                "password_hash = excluded.password_hash, role = excluded.role, meter_id = excluded.meter_id, "
                "display_name = excluded.display_name",
                (username, password_hash, role, meter_id, display_name),
            )

    def user(self, username: str) -> Optional[dict]:
        row = self.conn.execute("SELECT * FROM users WHERE username = ?", (username,)).fetchone()
        return dict(row) if row else None

    def add_session(self, token_hash: str, username: str, expires_at: datetime) -> None:
        with self.conn:
            self.conn.execute("INSERT INTO sessions VALUES (?, ?, ?)", (token_hash, username, expires_at.isoformat()))

    def session_user(self, token_hash: str, now: datetime) -> Optional[dict]:
        row = self.conn.execute(
            "SELECT u.* FROM sessions s JOIN users u ON u.username = s.username WHERE s.token_hash = ? AND s.expires_at > ?",
            (token_hash, now.isoformat()),
        ).fetchone()
        return dict(row) if row else None

    def delete_session(self, token_hash: str) -> None:
        with self.conn:
            self.conn.execute("DELETE FROM sessions WHERE token_hash = ?", (token_hash,))

    # Audit log

    @staticmethod
    def _audit_hash(prev_hash: str, at: str, actor: str, action: str, target: str, details: str) -> str:
        payload = json.dumps([prev_hash, at, actor, action, target, details])
        return hashlib.sha256(payload.encode()).hexdigest()

    def audit(self, actor: str, action: str, target: str, details: Optional[dict] = None) -> None:
        at, details_json = _now(), json.dumps(details or {}, sort_keys=True)
        with self.conn:
            row = self.conn.execute("SELECT hash FROM audit_log ORDER BY seq DESC LIMIT 1").fetchone()
            prev = row[0] if row else GENESIS_HASH
            self.conn.execute(
                "INSERT INTO audit_log (at, actor, action, target, details, prev_hash, hash) VALUES (?, ?, ?, ?, ?, ?, ?)",
                (at, actor, action, target, details_json, prev, self._audit_hash(prev, at, actor, action, target, details_json)),
            )

    def audit_entries(self, limit: int = 200) -> list[dict]:
        rows = self.conn.execute("SELECT * FROM audit_log ORDER BY seq DESC LIMIT ?", (limit,))
        return [{**dict(r), "details": json.loads(r["details"])} for r in rows]

    def verify_audit_chain(self) -> Optional[int]:
        """Return the seq of the first broken entry, or None if the chain is intact."""
        prev = GENESIS_HASH
        for r in self.conn.execute("SELECT * FROM audit_log ORDER BY seq"):
            expected = self._audit_hash(prev, r["at"], r["actor"], r["action"], r["target"], r["details"])
            if r["prev_hash"] != prev or r["hash"] != expected:
                return r["seq"]
            prev = r["hash"]
        return None
