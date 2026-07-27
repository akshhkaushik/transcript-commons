#!/usr/bin/env python3
"""Sequential batch runner with conservative pacing and retry output."""

from __future__ import annotations

import argparse
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INGEST = ROOT / "scripts" / "ingest.py"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("file", help="Text file containing one YouTube URL per line.")
    parser.add_argument("--delay", type=float, default=1.0)
    parser.add_argument("--force-local", action="store_true")
    parser.add_argument("--engine", choices=["mlx", "whisper-cpp"], default="mlx")
    args = parser.parse_args()

    urls = [
        line.strip()
        for line in Path(args.file).read_text(encoding="utf-8").splitlines()
        if line.strip() and not line.lstrip().startswith("#")
    ]
    failures: list[str] = []

    for index, url in enumerate(urls, start=1):
        print(f"[{index}/{len(urls)}] {url}", flush=True)
        command = [sys.executable, str(INGEST), url, "--engine", args.engine]
        if args.force_local:
            command.append("--force-local")
        result = subprocess.run(command, check=False)
        if result.returncode:
            failures.append(url)
        if index != len(urls):
            time.sleep(args.delay)

    if failures:
        retry_file = ROOT / "failed-urls.txt"
        retry_file.write_text("\n".join(failures) + "\n", encoding="utf-8")
        print(f"{len(failures)} failed URL(s) written to {retry_file}")
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
