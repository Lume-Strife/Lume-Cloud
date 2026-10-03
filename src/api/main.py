"""Run: uvicorn src.api.main:app --reload

Env: PLATFORM_DB (default data/platform.db), INGEST_API_KEY (ingestion disabled if unset).
"""
import os

from src.store import SQLiteStore

from .app import create_app

app = create_app(
    SQLiteStore(os.environ.get("PLATFORM_DB", "data/platform.db")),
    ingest_api_key=os.environ.get("INGEST_API_KEY"),
)
