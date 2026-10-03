"""Reading store. SQLite for local runs and the demo; the DynamoDB store will share this interface."""
from __future__ import annotations

import json
import sqlite3
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Iterable, Optional, Union

from .validate import FeederReading, MeterReading, Reading

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
"""


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
        self.conn = sqlite3.connect(str(path))
        self.conn.executescript(SCHEMA)

    def close(self) -> None:
        self.conn.close()

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

    def feeder_band(self, feeder_id: str) -> Optional[str]:
        row = self.conn.execute("SELECT band FROM feeders WHERE feeder_id = ?", (feeder_id,)).fetchone()
        return row[0] if row else None

    def meter_feeder(self, meter_id: str) -> Optional[str]:
        row = self.conn.execute("SELECT feeder_id FROM meters WHERE meter_id = ?", (meter_id,)).fetchone()
        return row[0] if row else None

    def meter_ids(self) -> list[str]:
        return [r[0] for r in self.conn.execute("SELECT meter_id FROM meters ORDER BY meter_id")]

    # Readings

    def save(self, readings: Iterable[Reading], result: Optional[IngestResult] = None) -> IngestResult:
        """Insert validated readings idempotently. Safe to replay and order-independent."""
        result = result or IngestResult()
        received_at = datetime.now().isoformat(timespec="seconds")
        with self.conn:
            for r in readings:
                if isinstance(r, MeterReading):
                    kind, source_id = "meter", r.meter_id
                    table, key_col = "meter_readings", "meter_id"
                    values = {"kwh": r.kwh, "voltage": r.voltage, "tamper": int(r.tamper)}
                else:
                    kind, source_id = "feeder", r.feeder_id
                    table, key_col = "feeder_readings", "feeder_id"
                    values = {"voltage": r.voltage}
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
        rows = self.conn.execute(
            "SELECT ts, voltage FROM feeder_readings WHERE feeder_id = ? AND ts >= ? AND ts < ? ORDER BY ts",
            (feeder_id, start.isoformat(), end.isoformat()),
        )
        return [(datetime.fromisoformat(ts), v) for ts, v in rows]

    def meter_readings(self, meter_id: str, start: datetime, end: datetime) -> list[MeterReading]:
        rows = self.conn.execute(
            "SELECT ts, kwh, voltage, tamper FROM meter_readings WHERE meter_id = ? AND ts >= ? AND ts < ? ORDER BY ts",
            (meter_id, start.isoformat(), end.isoformat()),
        )
        return [MeterReading(meter_id, datetime.fromisoformat(ts), kwh, v, bool(t)) for ts, kwh, v, t in rows]

    def conflict_count(self) -> int:
        return self.conn.execute("SELECT COUNT(*) FROM ingest_conflicts").fetchone()[0]
