"""Shared fixtures. Every store implementation is added to STORE_FACTORIES and then
runs the whole contract suite in test_store_contract.py."""
import pytest

from src.store import SQLiteStore

STORE_FACTORIES = {
    "sqlite": lambda: SQLiteStore(),
}


@pytest.fixture(params=list(STORE_FACTORIES))
def store(request):
    s = STORE_FACTORIES[request.param]()
    yield s
    s.close()
