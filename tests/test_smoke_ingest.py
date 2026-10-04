"""Runs scripts/smoke_ingest.py against the in-process pipeline, so the script's logic stays correct."""
import dataclasses

from conftest import TABLES
from scripts.smoke_ingest import run_ingest_smoke
from src.ingest.lambda_handlers import Receiver
from test_lambda_ingest import KEY, Env


def _pipeline(env, process=True):
    receiver = Receiver(env.sqs, env.queue_url, env.key)  # real clock, like the deployed function

    def post(key, body):
        headers = {"x-api-key": key} if key else {}
        response = receiver.handle({"headers": headers, "body": body})
        if process:
            env.writer.handle(env.drain())  # queue and writer run straight away
        return response["statusCode"], response["body"]

    return post


def _count_items(env):
    return len(env.store._scan_all(env.store.readings))


def test_smoke_passes_and_leaves_nothing_behind(dynamodb_resource):
    env, lines = Env(dynamodb_resource), []
    dlq = env.sqs.create_queue(QueueName="dlq")["QueueUrl"]
    assert run_ingest_smoke(_pipeline(env), KEY, env.store, env.sqs, dlq, wait=1, out=lines.append), "\n".join(lines)
    assert _count_items(env) == 0 and any("0 left" in line for line in lines)


def test_smoke_fails_loudly_when_the_endpoint_ignores_the_key(dynamodb_resource):
    env, lines = Env(dynamodb_resource), []
    real = _pipeline(env)
    lenient = lambda key, body: real(KEY, body)  # an endpoint that accepts anything
    assert run_ingest_smoke(lenient, KEY, env.store, wait=1, out=lines.append) is False
    assert any(line.startswith("FAIL  requests without the right key") for line in lines)
    assert _count_items(env) == 0  # still cleaned up


def test_smoke_fails_when_the_writer_never_runs(dynamodb_resource):
    env, lines = Env(dynamodb_resource), []
    assert run_ingest_smoke(_pipeline(env, process=False), KEY, env.store, wait=1, out=lines.append) is False
    assert any("reached DynamoDB" in line and line.startswith("FAIL") for line in lines)


def test_smoke_notices_a_writer_that_changes_data_on_replay(dynamodb_resource, monkeypatch):
    env, lines = Env(dynamodb_resource), []
    real_save, seen = env.store.save, set()

    def corrupts_replays(readings, *a, **kw):
        replay = any((r.meter_id, r.timestamp) in seen for r in readings)
        seen.update((r.meter_id, r.timestamp) for r in readings)
        if replay:  # a broken writer: overwrites what is stored instead of keeping the first value
            readings = [dataclasses.replace(r, kwh=r.kwh + 100) for r in readings]
            for r in readings:
                env.store.readings.delete_item(Key={"pk": f"METER#{r.meter_id}", "sk": r.timestamp.isoformat()})
        return real_save(readings, *a, **kw)

    monkeypatch.setattr(env.store, "save", corrupts_replays)
    assert run_ingest_smoke(_pipeline(env), KEY, env.store, wait=1, out=lines.append) is False
    assert any(line.startswith("FAIL  replaying readings changes nothing") for line in lines), lines
    assert _count_items(env) == 0


def test_smoke_notices_messages_in_the_dead_letter_queue(dynamodb_resource):
    env, lines = Env(dynamodb_resource), []
    dlq = env.sqs.create_queue(QueueName="dlq")["QueueUrl"]
    env.sqs.send_message(QueueUrl=dlq, MessageBody="a message that kept failing")
    assert run_ingest_smoke(_pipeline(env), KEY, env.store, env.sqs, dlq, wait=1, out=lines.append) is False
    assert any(line.startswith("FAIL  dead-letter queue is empty") and "1 message" in line for line in lines), lines
