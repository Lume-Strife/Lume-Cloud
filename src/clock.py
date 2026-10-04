"""One clock for the whole app: naive West Africa Time (WAT, UTC+1, no daylight saving).

Never call datetime.now() without a timezone anywhere else. On Lambda and CI runners it returns
UTC, an hour behind WAT, and that silently shifts session expiry, audit timestamps and the
DynamoDB TTL values derived from them. Import now_wat() instead.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

WAT = timezone(timedelta(hours=1))


def now_wat() -> datetime:
    return datetime.now(WAT).replace(tzinfo=None)


def now_wat_iso() -> str:
    return now_wat().isoformat(timespec="seconds")
