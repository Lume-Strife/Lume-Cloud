"""Password hashing and session tokens. Tokens are stored hashed, so a leaked database
does not leak live sessions."""
from __future__ import annotations

import hashlib
import hmac
import secrets
from datetime import datetime, timedelta
from typing import Optional

from src.store import SQLiteStore

ROLES = ("customer", "operations", "regulator")
SESSION_TTL = timedelta(hours=12)
_SCRYPT = {"n": 2**14, "r": 8, "p": 1}


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.scrypt(password.encode(), salt=salt, **_SCRYPT)
    return f"scrypt${salt.hex()}${digest.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        scheme, salt_hex, digest_hex = stored.split("$")
    except ValueError:
        return False
    if scheme != "scrypt":
        return False
    digest = hashlib.scrypt(password.encode(), salt=bytes.fromhex(salt_hex), **_SCRYPT)
    return hmac.compare_digest(digest.hex(), digest_hex)


# Verified against when the username does not exist, so response time does not reveal valid usernames.
_DUMMY_HASH = hash_password(secrets.token_hex(8))


def _token_hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def login(store: SQLiteStore, username: str, password: str, now: Optional[datetime] = None) -> Optional[tuple[str, dict]]:
    user = store.user(username)
    if not verify_password(password, user["password_hash"] if user else _DUMMY_HASH) or user is None:
        return None
    token = secrets.token_urlsafe(32)
    store.add_session(_token_hash(token), username, (now or datetime.now()) + SESSION_TTL)
    return token, user


def user_for_token(store: SQLiteStore, token: str, now: Optional[datetime] = None) -> Optional[dict]:
    return store.session_user(_token_hash(token), now or datetime.now())


def logout(store: SQLiteStore, token: str) -> None:
    store.delete_session(_token_hash(token))


def public_user(user: dict) -> dict:
    return {k: user[k] for k in ("username", "role", "display_name", "meter_id")}
