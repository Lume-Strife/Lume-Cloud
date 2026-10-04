"""The Lambda package must work on its own: no repo checkout, no FastAPI, no test tools."""
import os
import subprocess
import sys
import zipfile

from scripts.build_lambda import FILES, build

BLOCK = "fastapi pydantic uvicorn starlette httpx moto pytest".split()
PROBE = (
    "import sys\n"
    f"for name in {BLOCK!r}: sys.modules[name] = None  # importing any of these now raises ImportError\n"
    "import src.ingest.lambda_handlers as handlers\n"
    "import src.store_dynamodb\n"
    "print(handlers.__file__)\n"
)


def test_zip_holds_exactly_the_listed_files(tmp_path):
    with zipfile.ZipFile(build(tmp_path / "l.zip")) as zf:
        assert sorted(zf.namelist()) == sorted(FILES)


def test_build_is_reproducible(tmp_path):
    a, b = build(tmp_path / "a.zip").read_bytes(), build(tmp_path / "b.zip").read_bytes()
    assert a == b


def test_zip_imports_on_its_own(tmp_path):
    package = build(tmp_path / "lambda.zip")
    run = subprocess.run(
        [sys.executable, "-c", PROBE], cwd=tmp_path, capture_output=True, text=True,
        env={**os.environ, "PYTHONPATH": str(package)},
    )
    assert run.returncode == 0, run.stderr
    assert "lambda.zip" in run.stdout  # it came from the package, not from a repo checkout
