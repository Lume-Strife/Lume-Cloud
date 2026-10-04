"""The API package must work on its own, the way Lambda runs it: unpacked on disk, no repo, no test tools."""
import os
import platform
import subprocess
import sys
import zipfile

import pytest

from scripts.build_api_lambda import build

LINUX_X86 = sys.platform == "linux" and platform.machine() in ("x86_64", "AMD64")
BLOCK = "moto pytest uvicorn httpx".split()
PROBE = '''
import sys
for name in {block!r}: sys.modules[name] = None  # importing any of these now raises ImportError
import json, pydantic, mangum, fastapi
from src.accountability.engine import load_config
from src.api.lambda_handler import build_handler
assert load_config()["bands"], "config/bands.json was not found next to src/"
event = {{"version": "2.0", "routeKey": "$default", "rawPath": "/health", "rawQueryString": "", "isBase64Encoded": False, "body": None,
         "headers": {{"host": "x.execute-api.eu-west-1.amazonaws.com"}},
         "requestContext": {{"http": {{"method": "GET", "path": "/health", "protocol": "HTTP/1.1", "sourceIp": "1.2.3.4", "userAgent": "t"}}, "stage": "$default"}}}}
resp = build_handler(object())(event, None)
print(json.dumps({{"status": resp["statusCode"], "pydantic": pydantic.__file__}}))
'''.format(block=BLOCK)


@pytest.fixture(scope="module")
def package(tmp_path_factory):
    return build(tmp_path_factory.mktemp("api") / "api.zip")


def test_package_holds_the_app_its_config_and_the_linux_dependencies(package):
    names = set(zipfile.ZipFile(package).namelist())
    assert {"src/api/lambda_handler.py", "src/store_dynamodb.py", "config/bands.json", "config/tariffs.json", "config/detection.json"} <= names
    assert any(n.startswith("fastapi/") for n in names) and any(n.startswith("mangum/") for n in names)
    assert "pydantic_core/_pydantic_core.cpython-312-x86_64-linux-gnu.so" in names  # Linux build, not this machine's


def test_package_leaves_out_what_does_not_belong_in_it(package):
    names = zipfile.ZipFile(package).namelist()
    assert not [n for n in names if n.startswith(("tests/", "scripts/", "boto3/", "botocore/", "moto/", "pytest", "_pytest/"))]
    assert not [n for n in names if "__pycache__" in n or n.endswith(".pyc")]


def test_package_fits_the_direct_upload_limit(package):
    assert package.stat().st_size < 50 * 1024 * 1024


def test_build_is_reproducible(package, tmp_path):
    assert build(tmp_path / "second.zip").read_bytes() == package.read_bytes()


@pytest.mark.skipif(not LINUX_X86, reason="the Linux wheels can only be imported on Linux x86_64 (CI covers this)")
def test_unpacked_package_serves_a_request_on_its_own(package, tmp_path):
    unpacked = tmp_path / "var_task"
    zipfile.ZipFile(package).extractall(unpacked)
    run = subprocess.run(
        [sys.executable, "-S", "-c", PROBE], cwd=tmp_path,  # -S: no site-packages, so nothing can be silently borrowed from the test environment
        capture_output=True, text=True,
        env={**os.environ, "PYTHONPATH": str(unpacked), "PYTHONDONTWRITEBYTECODE": "1"},
    )
    assert run.returncode == 0, run.stderr[-1500:]
    assert '"status": 200' in run.stdout and str(unpacked) in run.stdout  # served by the package's own pydantic
