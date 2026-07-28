#!/usr/bin/env python3
"""Run Transcript Commons as the local compute worker for Transcript Registry."""

from __future__ import annotations

import argparse
import os
import re
import socket
import subprocess
import sys
import tempfile
import time
from pathlib import Path
from typing import Any

from registry_api import ROOT, configuration, registry_record, request_json
from transcript_pipeline import load_records

INGEST = ROOT / "scripts" / "ingest.py"
DISCOVER = ROOT / "scripts" / "discover.py"
def worker_id() -> str:
    return os.environ.get(
        "WORKER_ID",
        f"commons-{socket.gethostname()}-{os.getpid()}",
    )


def ingest_command(url: str) -> list[str]:
    command = [
        sys.executable,
        str(INGEST),
        url,
        "--engine",
        os.environ.get("ASR_ENGINE", "mlx"),
        "--language",
        os.environ.get("TRANSCRIPT_LANGUAGE", "en"),
        "--model",
        os.environ.get(
            "MLX_WHISPER_MODEL",
            "mlx-community/whisper-small-mlx",
        ),
        "--audio-fallback",
        os.environ.get("AUDIO_FALLBACK", "permissioned"),
    ]
    options = (
        ("YT_DLP_BINARY", "--yt-dlp"),
        ("WHISPER_CPP_BINARY", "--whisper-cpp"),
        ("WHISPER_CPP_MODEL", "--whisper-cpp-model"),
        ("COOKIES_FROM_BROWSER", "--cookies-from-browser"),
    )
    for environment, option in options:
        value = os.environ.get(environment)
        if value:
            command.extend([option, value])
    return command


def process_video(job: dict[str, Any]) -> None:
    result = subprocess.run(
        ingest_command(str(job["sourceUrl"])),
        cwd=ROOT,
        check=False,
        capture_output=True,
        text=True,
        timeout=7200,
    )
    if result.returncode:
        raise RuntimeError((result.stderr or result.stdout)[-3000:])
    record = next(
        (
            item
            for item in load_records()
            if item.get("videoId") == job.get("providerId")
        ),
        None,
    )
    if not record:
        raise RuntimeError("Ingestion finished without a local transcript record")
    request_json(
        f"/api/worker/{job['id']}/complete",
        registry_record(record),
        timeout=300,
    )


def process_topic(job: dict[str, Any]) -> None:
    with tempfile.TemporaryDirectory(prefix="commons-topic-") as directory:
        queue = Path(directory) / "queue.txt"
        command = [
            sys.executable,
            str(DISCOVER),
            "--query",
            str(job["query"]),
            "--limit",
            str(max(1, min(int(job.get("targetCount") or 8), 25))),
            "--output",
            str(queue),
        ]
        if os.environ.get("YT_DLP_BINARY"):
            command.extend(["--yt-dlp", os.environ["YT_DLP_BINARY"]])
        if os.environ.get("COOKIES_FROM_BROWSER"):
            command.extend(
                ["--cookies-from-browser", os.environ["COOKIES_FROM_BROWSER"]]
            )
        result = subprocess.run(
            command,
            cwd=ROOT,
            check=False,
            capture_output=True,
            text=True,
            timeout=600,
        )
        if result.returncode:
            raise RuntimeError((result.stderr or result.stdout)[-3000:])
        urls = [
            match.group(0)
            for line in queue.read_text("utf-8").splitlines()
            if (match := re.search(r"https://www\.youtube\.com/watch\?v=[\w-]{11}", line))
        ]
    request_json(
        f"/api/worker/topics/{job['id']}/complete",
        {"videoUrls": urls},
    )


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--once", action="store_true")
    parser.add_argument("--check", action="store_true")
    parser.add_argument("--poll-seconds", type=int, default=15)
    args = parser.parse_args()
    configuration()
    if args.check:
        print("registry worker configured")
        return 0

    while True:
        video = request_json(
            "/api/worker/claim", {"workerId": worker_id()}
        ).get("job")
        if video:
            try:
                process_video(video)
                print(f"completed video {video['providerId']}", flush=True)
            except Exception as error:  # noqa: BLE001
                message = str(error)[:1000]
                print(f"failed video {video['providerId']}: {message}", flush=True)
                request_json(
                    f"/api/worker/{video['id']}/fail",
                    {"error": message},
                )
            if args.once:
                return 0
            continue

        topic = request_json(
            "/api/worker/topics/claim", {"workerId": worker_id()}
        ).get("job")
        if topic:
            try:
                process_topic(topic)
                print(f"completed topic {topic['query']}", flush=True)
            except Exception as error:  # noqa: BLE001
                message = str(error)[:1000]
                print(f"failed topic {topic['query']}: {message}", flush=True)
                request_json(
                    f"/api/worker/topics/{topic['id']}/fail",
                    {"error": message},
                )
            if args.once:
                return 0
            continue

        if args.once:
            return 0
        time.sleep(max(3, args.poll_seconds))


if __name__ == "__main__":
    raise SystemExit(main())
