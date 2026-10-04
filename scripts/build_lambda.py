"""Build build/lambda.zip, the deployment package for the ingest Lambdas.

    python scripts/build_lambda.py

It holds only the modules the two functions import (boto3 is already in the Lambda runtime).
The zip is byte-for-byte reproducible, so Terraform only sees a change when the code changes.
If you add an import to these modules, add the file to FILES: tests/test_build_lambda.py fails
if the zip cannot import on its own.
"""
from __future__ import annotations

import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FILES = [
    "src/__init__.py",
    "src/clock.py",
    "src/store.py",
    "src/store_dynamodb.py",
    "src/ingest/__init__.py",
    "src/ingest/handler.py",
    "src/ingest/lambda_handlers.py",
    "src/ingest/validate.py",
]
FIXED_TIME = (2020, 1, 1, 0, 0, 0)


def build(out: Path) -> Path:
    out.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as zf:
        for rel in sorted(FILES):
            info = zipfile.ZipInfo(rel, FIXED_TIME)
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o644 << 16
            zf.writestr(info, (ROOT / rel).read_bytes())
    return out


if __name__ == "__main__":
    target = build(ROOT / "build" / "lambda.zip")
    print(f"Built {target} ({target.stat().st_size / 1024:.1f} KB, {len(FILES)} files)")
    sys.exit(0)
