#!/usr/bin/env python3
"""Resumable, conservatively paced batch ingestion for Transcript Commons."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import subprocess
import sys
import time
from pathlib import Path
from typing import Any

try:
    from transcript_pipeline import ROOT, load_records, utc_now, youtube_video_id
except ModuleNotFoundError:  # Imported as scripts.ingest_batch in unit tests.
    from scripts.transcript_pipeline import ROOT, load_records, utc_now, youtube_video_id

INGEST = ROOT / "scripts" / "ingest.py"
DEFAULT_STATE = ROOT / "var" / "ingest-state.json"


def load_urls(path: Path) -> list[str]:
    urls: list[str] = []
    seen: set[str] = set()
    for line in path.read_text(encoding="utf-8").splitlines():
        value = line.split(" #", 1)[0].strip()
        if not value or value.startswith("#"):
            continue
        key = youtube_video_id(value) or value
        if key not in seen:
            seen.add(key)
            urls.append(value)
    return urls


def item_key(url: str) -> str:
    return youtube_video_id(url) or hashlib.sha256(url.encode()).hexdigest()[:16]


def load_state(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {"version": 1, "updatedAt": utc_now(), "items": {}}
    payload = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(payload.get("items"), dict):
        raise RuntimeError(f"Invalid state file: {path}")
    return payload


def save_state(path: Path, state: dict[str, Any]) -> None:
    state["updatedAt"] = utc_now()
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(".tmp")
    temporary.write_text(
        json.dumps(state, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    temporary.replace(path)


def command_for(args: argparse.Namespace, url: str) -> list[str]:
    command = [
        sys.executable,
        str(INGEST),
        url,
        "--engine",
        args.engine,
        "--language",
        args.language,
        "--model",
        args.model,
        "--min-words",
        str(args.min_words),
    ]
    if args.force_local:
        command.append("--force-local")
    if args.no_asr_fallback:
        command.append("--no-asr-fallback")
    if args.refresh:
        command.append("--refresh")
    if args.cookies_from_browser:
        command.extend(["--cookies-from-browser", args.cookies_from_browser])
    if args.yt_dlp:
        command.extend(["--yt-dlp", args.yt_dlp])
    if args.whisper_cpp:
        command.extend(["--whisper-cpp", args.whisper_cpp])
    if args.whisper_cpp_model:
        command.extend(["--whisper-cpp-model", args.whisper_cpp_model])
    for topic in args.topic:
        command.extend(["--topic", topic])
    return command


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Process a URL list with resumable state and retries."
    )
    parser.add_argument("file", help="Text file containing one YouTube URL per line.")
    parser.add_argument("--state-file", type=Path, default=DEFAULT_STATE)
    parser.add_argument("--delay", type=float, default=1.5)
    parser.add_argument("--retries", type=int, default=2)
    parser.add_argument("--retry-base-delay", type=float, default=5.0)
    parser.add_argument("--max-items", type=int)
    parser.add_argument("--force-local", action="store_true")
    parser.add_argument("--no-asr-fallback", action="store_true")
    parser.add_argument("--refresh", action="store_true")
    parser.add_argument("--language", default="en")
    parser.add_argument("--engine", choices=["mlx", "whisper-cpp"], default="mlx")
    parser.add_argument("--model", default="mlx-community/whisper-small-mlx")
    parser.add_argument("--min-words", type=int, default=20)
    parser.add_argument("--topic", action="append", default=[])
    parser.add_argument("--cookies-from-browser")
    parser.add_argument("--yt-dlp", default=os.environ.get("YT_DLP_BINARY"))
    parser.add_argument("--whisper-cpp", default=os.environ.get("WHISPER_CPP_BINARY"))
    parser.add_argument(
        "--whisper-cpp-model", default=os.environ.get("WHISPER_CPP_MODEL")
    )
    args = parser.parse_args()

    urls = load_urls(Path(args.file))
    state = load_state(args.state_file)
    published = {str(item.get("videoId")) for item in load_records()}

    for url in urls:
        key = item_key(url)
        state["items"].setdefault(
            key,
            {
                "url": url,
                "status": "pending",
                "attempts": 0,
                "lastError": None,
                "updatedAt": utc_now(),
            },
        )
        if key in published and not args.refresh:
            state["items"][key]["status"] = "published"
    save_state(args.state_file, state)

    pending = [
        (item_key(url), url)
        for url in urls
        if state["items"][item_key(url)]["status"]
        not in {"succeeded", "published"}
    ]
    if args.max_items is not None:
        pending = pending[: args.max_items]

    failures = 0
    try:
        for index, (key, url) in enumerate(pending, start=1):
            item = state["items"][key]
            print(f"[{index}/{len(pending)}] {url}", flush=True)
            succeeded = False

            for local_attempt in range(args.retries + 1):
                item["status"] = "running"
                item["attempts"] += 1
                item["updatedAt"] = utc_now()
                save_state(args.state_file, state)

                result = subprocess.run(
                    command_for(args, url),
                    check=False,
                    text=True,
                    capture_output=True,
                )
                if result.stdout:
                    print(result.stdout.rstrip())
                if result.returncode == 0:
                    item["status"] = "succeeded"
                    item["lastError"] = None
                    item["updatedAt"] = utc_now()
                    succeeded = True
                    save_state(args.state_file, state)
                    break

                error = (result.stderr or result.stdout or "unknown failure").strip()
                item["lastError"] = error[-4000:]
                item["status"] = "retrying" if local_attempt < args.retries else "failed"
                item["updatedAt"] = utc_now()
                save_state(args.state_file, state)
                print(error, file=sys.stderr)
                if local_attempt < args.retries:
                    time.sleep(args.retry_base_delay * (2**local_attempt))

            if not succeeded:
                failures += 1
            if index != len(pending):
                time.sleep(max(0, args.delay))
    except KeyboardInterrupt:
        print("Interrupted; progress has been saved.", file=sys.stderr)
        save_state(args.state_file, state)
        return 130

    succeeded_count = sum(
        item["status"] in {"succeeded", "published"}
        for item in state["items"].values()
    )
    print(
        f"Batch complete: {succeeded_count} available, {failures} failed. "
        f"State: {args.state_file}"
    )
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
