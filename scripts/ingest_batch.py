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
import urllib.error
import urllib.request
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


def write_summary(
    path: Path,
    *,
    state_file: Path,
    total: int,
    available: int,
    failed: int,
    status: str,
) -> dict[str, Any]:
    payload = {
        "version": 1,
        "status": status,
        "updatedAt": utc_now(),
        "stateFile": str(state_file),
        "total": total,
        "available": available,
        "failed": failed,
    }
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(".tmp")
    temporary.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    temporary.replace(path)
    return payload


def desktop_alert(title: str, message: str) -> None:
    if sys.platform != "darwin":
        print(f"alert: {title}: {message}", file=sys.stderr)
        return
    script = (
        f"display notification {json.dumps(message)} "
        f"with title {json.dumps(title)}"
    )
    subprocess.run(
        ["osascript", "-e", script],
        check=False,
        capture_output=True,
        text=True,
    )


def webhook_alert(url: str, payload: dict[str, Any]) -> None:
    request = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"content-type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=15) as response:
            if response.status >= 400:
                raise RuntimeError(f"webhook returned HTTP {response.status}")
    except (urllib.error.URLError, TimeoutError, RuntimeError) as error:
        print(f"warning: failed to send ingestion webhook: {error}", file=sys.stderr)


def send_alerts(
    payload: dict[str, Any], *, notify_desktop: bool, webhook_url: str | None
) -> None:
    title = "Transcript Commons ingestion"
    message = (
        f"{payload['available']}/{payload['total']} available; "
        f"{payload['failed']} failed ({payload['status']})."
    )
    if notify_desktop:
        desktop_alert(title, message)
    if webhook_url:
        webhook_alert(webhook_url, {"title": title, "message": message, **payload})


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
    parser.add_argument(
        "--notify",
        action="store_true",
        help="Show a macOS desktop notification when the batch finishes.",
    )
    parser.add_argument(
        "--alert-webhook",
        default=os.environ.get("INGEST_ALERT_WEBHOOK"),
        help="POST the final JSON summary to this webhook URL.",
    )
    parser.add_argument(
        "--summary-file",
        type=Path,
        help="Final JSON summary path (defaults beside the state file).",
    )
    args = parser.parse_args()
    summary_file = args.summary_file or args.state_file.with_name(
        f"{args.state_file.stem}-summary.json"
    )

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
        available = sum(
            item["status"] in {"succeeded", "published"}
            for item in state["items"].values()
        )
        summary = write_summary(
            summary_file,
            state_file=args.state_file,
            total=len(urls),
            available=available,
            failed=sum(item["status"] == "failed" for item in state["items"].values()),
            status="interrupted",
        )
        send_alerts(
            summary,
            notify_desktop=args.notify,
            webhook_url=args.alert_webhook,
        )
        return 130

    succeeded_count = sum(
        item["status"] in {"succeeded", "published"}
        for item in state["items"].values()
    )
    print(
        f"Batch complete: {succeeded_count} available, {failures} failed. "
        f"State: {args.state_file}"
    )
    summary = write_summary(
        summary_file,
        state_file=args.state_file,
        total=len(urls),
        available=succeeded_count,
        failed=failures,
        status="failed" if failures else "succeeded",
    )
    send_alerts(
        summary,
        notify_desktop=args.notify,
        webhook_url=args.alert_webhook,
    )
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
