"""Build build/api.zip, the deployment package for the dashboard API Lambda.

    python scripts/build_api_lambda.py

Contents: all of src/, config/*.json (the engines read them relative to the package root), and the
Linux builds of the packages pinned in requirements-lambda.txt. pip downloads those Linux wheels
whatever your own OS is, so this works the same on Windows. boto3 is not included: the Lambda
runtime has it. The zip is byte-for-byte reproducible, so Terraform only redeploys on a real change.
"""
from __future__ import annotations

import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REQUIREMENTS = ROOT / "requirements-lambda.txt"
LAMBDA_PLATFORM = "manylinux2014_x86_64"  # the API function runs on x86_64
PYTHON_VERSION = "3.12"  # the Lambda runtime
FIXED_TIME = (2020, 1, 1, 0, 0, 0)
SKIP_PARTS = {"__pycache__", "bin"}


def install_dependencies(target: Path, platform: str = LAMBDA_PLATFORM) -> None:
    subprocess.run(
        [sys.executable, "-m", "pip", "install", "--quiet", "--disable-pip-version-check", "--no-deps", "--no-compile",
         "--only-binary=:all:", "--platform", platform, "--python-version", PYTHON_VERSION, "--implementation", "cp",
         "-r", str(REQUIREMENTS), "--target", str(target)],
        check=True,
    )


def _package_files(deps: Path) -> dict[str, Path]:
    files: dict[str, Path] = {}
    for path in deps.rglob("*"):
        if path.is_file() and not (SKIP_PARTS & set(path.relative_to(deps).parts)) and path.suffix != ".pyc":
            files[path.relative_to(deps).as_posix()] = path
    for path in (ROOT / "src").rglob("*.py"):
        if "__pycache__" not in path.parts:
            files[path.relative_to(ROOT).as_posix()] = path
    for path in (ROOT / "config").glob("*.json"):
        files[f"config/{path.name}"] = path
    return files


def build(out: Path, platform: str = LAMBDA_PLATFORM) -> Path:
    out.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        deps = Path(tmp)
        install_dependencies(deps, platform)
        files = _package_files(deps)
        with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as zf:
            for name in sorted(files):
                info = zipfile.ZipInfo(name, FIXED_TIME)
                info.compress_type = zipfile.ZIP_DEFLATED
                info.external_attr = (0o755 if name.endswith(".so") else 0o644) << 16
                zf.writestr(info, files[name].read_bytes())
    return out


if __name__ == "__main__":
    target = build(ROOT / "build" / "api.zip")
    print(f"Built {target} ({target.stat().st_size / 1024 / 1024:.1f} MB). Direct-upload limit is 50 MB.")
