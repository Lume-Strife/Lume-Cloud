"""AWS Lambda entry point for the dashboard API.

    API Gateway (HTTP API, payload v2) -> Mangum -> FastAPI app -> DynamoDBStore

Ingestion does not go through here: devices use the separate ingest endpoint (src/ingest/lambda_handlers.py),
so the app's own /ingest route is left disabled (no key is configured), which answers 503.
"""
from __future__ import annotations

import os
from typing import Optional

from mangum import Mangum

from src.api.app import create_app


def build_handler(store) -> Mangum:
    # lifespan="off": the app has no startup or shutdown hooks, and Lambda has no lifespan events.
    return Mangum(create_app(store, ingest_api_key=None), lifespan="off")


_handler: Optional[Mangum] = None


def handler(event: dict, context=None) -> dict:
    """Built on first use, then reused for every request this container serves."""
    global _handler
    if _handler is None:
        from src.store_dynamodb import DynamoDBStore

        store = DynamoDBStore(os.environ["READINGS_TABLE"], os.environ["PLATFORM_TABLE"], os.environ["AUDIT_TABLE"])
        _handler = build_handler(store)
    return _handler(event, context)
