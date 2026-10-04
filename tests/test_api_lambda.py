"""The dashboard API as Lambda runs it: API Gateway v2 events -> Mangum -> FastAPI -> DynamoDBStore (moto)."""
import json
from datetime import datetime, timedelta
from urllib.parse import urlencode

import pytest

from conftest import TABLES
from src.api.auth import hash_password
from src.api.lambda_handler import build_handler
from src.ingest.validate import FeederReading, MeterReading
from src.store_dynamodb import DynamoDBStore

START = datetime(2026, 9, 1)
SLOTS = [START + timedelta(minutes=15 * i) for i in range(96 * 3)]
PASSWORD = "lambda-test-password"


def event(method, path, body=None, token=None, query=None):
    headers = {"content-type": "application/json", "host": "abc.execute-api.eu-west-1.amazonaws.com"}
    if token:
        headers["authorization"] = f"Bearer {token}"
    return {
        "version": "2.0", "routeKey": "$default", "rawPath": path, "rawQueryString": urlencode(query or {}),
        "headers": headers, "isBase64Encoded": False, "body": json.dumps(body) if body is not None else None,
        "requestContext": {
            "accountId": "123456789012", "apiId": "abc", "domainName": "abc.execute-api.eu-west-1.amazonaws.com",
            "http": {"method": method, "path": path, "protocol": "HTTP/1.1", "sourceIp": "203.0.113.9", "userAgent": "test"},
            "requestId": "req-1", "routeKey": "$default", "stage": "$default", "time": "04/Oct/2026:12:00:00 +0000", "timeEpoch": 1790000000000,
        },
    }


@pytest.fixture
def lam(dynamodb_resource):
    store = DynamoDBStore(TABLES["readings"], TABLES["platform"], TABLES["audit"], resource=dynamodb_resource, allow_reset=True)
    store.upsert_feeder("F001", "A")
    for m in ("M001", "M002"):
        store.upsert_meter(m, "F001")
    store.save([FeederReading("F001", t, 230.0 if t.hour >= 6 else 0.0, 2.0) for t in SLOTS])
    store.save([MeterReading(m, t, 0.1 if t.hour >= 6 else 0.0) for m in ("M001", "M002") for t in SLOTS])
    for name, role, meter in (("cust", "customer", "M001"), ("ops", "operations", None), ("reg", "regulator", None)):
        store.add_user(name, hash_password(PASSWORD), role, name.title(), meter)
    handler = build_handler(store)

    class Lam:
        def call(self, method, path, **kw):
            resp = handler(event(method, path, **kw), None)
            body = resp.get("body") or ""
            return resp["statusCode"], (json.loads(body) if body.startswith(("{", "[")) else body), resp

        def login(self, user):
            status, body, _ = self.call("POST", "/auth/login", body={"username": user, "password": PASSWORD})
            assert status == 200, body
            return body["token"]

    lam = Lam()
    lam.store = store
    return lam


def test_health_needs_no_login(lam):
    status, body, _ = lam.call("GET", "/health")
    assert status == 200 and body


def test_login_then_me(lam):
    token = lam.login("ops")
    status, body, _ = lam.call("GET", "/me", token=token)
    assert status == 200 and body["username"] == "ops" and body["role"] == "operations"


def test_requests_without_a_token_are_401(lam):
    assert lam.call("GET", "/me")[0] == 401
    assert lam.call("GET", "/me", token="made-up")[0] == 401


def test_wrong_password_is_401_and_audited(lam):
    status, _, _ = lam.call("POST", "/auth/login", body={"username": "ops", "password": "nope"})
    assert status == 401 and lam.store.audit_entries()[0]["action"] == "auth.login_failed"


def test_customer_dashboard_data_comes_back(lam):
    status, body, _ = lam.call("GET", "/customer/summary", token=lam.login("cust"))
    assert status == 200 and body


def test_query_string_parameters_reach_the_app(lam):
    token = lam.login("reg")
    full = lam.call("GET", "/regulator/compliance", token=token, query={"from": "2026-09-01", "to": "2026-09-04"})
    assert full[0] == 200
    bad = lam.call("GET", "/regulator/compliance", token=token, query={"from": "not-a-date", "to": "2026-09-04"})
    assert bad[0] == 422


def test_roles_are_enforced(lam):
    assert lam.call("GET", "/regulator/compliance", token=lam.login("cust"))[0] == 403
    assert lam.call("GET", "/customer/summary", token=lam.login("ops"))[0] == 403


def test_csv_export_keeps_its_content_type(lam):
    status, body, resp = lam.call("GET", "/regulator/compliance.csv", token=lam.login("reg"))
    assert status == 200 and "text/csv" in resp["headers"].get("content-type", "") and "feeder" in body.lower()


def test_unknown_routes_are_404(lam):
    assert lam.call("GET", "/nope")[0] == 404


def test_the_apps_own_ingest_route_is_disabled_on_lambda(lam):
    status, _, _ = lam.call("POST", "/ingest", body={"kind": "meter", "readings": [{"meter_id": "M001", "timestamp": "2026-09-01T10:00:00", "kwh": 1}]})
    assert status == 503  # disabled, not merely unauthorised: no key is configured on Lambda
    assert lam.store.meter_readings("M001", datetime(2026, 9, 1, 10, 0), datetime(2026, 9, 1, 10, 1))[0].kwh != 1


def test_detection_can_be_run_through_the_handler(lam):
    status, body, _ = lam.call("POST", "/ops/detection/run", body={}, token=lam.login("ops"))
    assert status == 200, body
