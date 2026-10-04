from src.store import SQLiteStore
from src.store_base import Store


def test_sqlite_store_implements_the_store_interface():
    store = SQLiteStore()
    assert isinstance(store, Store)
    store.close()
