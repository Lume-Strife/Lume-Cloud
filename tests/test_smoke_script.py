"""Runs the real-AWS smoke script against moto, so the script's own logic stays correct.
The threaded audit check is skipped here: moto does not serialise transactions across threads
(see run_smoke), so it is only meaningful on real AWS."""
from conftest import TABLES
from scripts.smoke_dynamodb import run_smoke
from src.store_dynamodb import DynamoDBStore


def _store(resource):
    return DynamoDBStore(TABLES["readings"], TABLES["platform"], TABLES["audit"], resource=resource, allow_reset=True)


def test_smoke_script_passes_and_cleans_up(dynamodb_resource):
    lines: list[str] = []
    assert run_smoke(_store(dynamodb_resource), wait=1.0, out=lines.append, concurrent=False), "\n".join(lines)
    assert any("cleanup: tables empty again = True" in line for line in lines)


def test_smoke_script_refuses_tables_that_hold_data(dynamodb_resource):
    store = _store(dynamodb_resource)
    store.upsert_feeder("REAL-FEEDER", "A")
    lines: list[str] = []
    assert run_smoke(store, wait=1.0, out=lines.append) is False
    assert lines[0].startswith("ABORTED")
    assert store.feeder_band("REAL-FEEDER") == "A"  # untouched
