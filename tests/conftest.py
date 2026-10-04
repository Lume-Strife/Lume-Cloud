"""Shared fixtures. Every store implementation listed in STORE_PARAMS runs the whole
contract suite in test_store_contract.py."""
import boto3
import pytest
from moto import mock_aws

from src.store import SQLiteStore
from src.store_dynamodb import DynamoDBStore

STORE_PARAMS = ["sqlite", "dynamodb"]
REGION = "eu-west-1"
TABLES = {"readings": "test-readings", "platform": "test-platform", "audit": "test-audit"}


def create_tables(client, names=TABLES) -> None:
    """Mirror infra/terraform: string pk/sk everywhere, plus gsi1 on the platform table."""
    for key, name in names.items():
        attrs = [{"AttributeName": "pk", "AttributeType": "S"}, {"AttributeName": "sk", "AttributeType": "S"}]
        extra: dict = {}
        if key == "platform":
            attrs += [{"AttributeName": "gsi1pk", "AttributeType": "S"}, {"AttributeName": "gsi1sk", "AttributeType": "S"}]
            extra["GlobalSecondaryIndexes"] = [
                {
                    "IndexName": "gsi1",
                    "KeySchema": [{"AttributeName": "gsi1pk", "KeyType": "HASH"}, {"AttributeName": "gsi1sk", "KeyType": "RANGE"}],
                    "Projection": {"ProjectionType": "ALL"},
                }
            ]
        client.create_table(
            TableName=name,
            KeySchema=[{"AttributeName": "pk", "KeyType": "HASH"}, {"AttributeName": "sk", "KeyType": "RANGE"}],
            AttributeDefinitions=attrs,
            BillingMode="PAY_PER_REQUEST",
            **extra,
        )


@pytest.fixture
def dynamodb_resource(monkeypatch):
    for var in ("AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "AWS_SESSION_TOKEN"):
        monkeypatch.setenv(var, "testing")
    monkeypatch.setenv("AWS_DEFAULT_REGION", REGION)
    with mock_aws():
        resource = boto3.resource("dynamodb", region_name=REGION)
        create_tables(resource.meta.client)
        yield resource


@pytest.fixture(params=STORE_PARAMS)
def store(request):
    if request.param == "sqlite":
        s = SQLiteStore()
        yield s
        s.close()
    else:
        resource = request.getfixturevalue("dynamodb_resource")
        s = DynamoDBStore(TABLES["readings"], TABLES["platform"], TABLES["audit"], resource=resource, allow_reset=True)
        yield s
        s.close()
