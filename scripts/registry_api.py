#!/usr/bin/env python3
"""Shared client and record adapter for the public Transcript Registry."""

from __future__ import annotations

import json
import os
import re
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]


def load_environment(path: Path = ROOT / ".env.worker") -> None:
    if not path.exists():
        return
    for raw_line in path.read_text("utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        if re.fullmatch(r"[A-Z][A-Z0-9_]*", key):
            os.environ.setdefault(key, value.strip().strip("\"'"))


def configuration() -> tuple[str, str]:
    load_environment()
    base_url = os.environ.get("REGISTRY_URL", "").rstrip("/")
    token = os.environ.get("WORKER_TOKEN", "")
    if not base_url or not token:
        raise RuntimeError("REGISTRY_URL and WORKER_TOKEN are required")
    return base_url, token


def request_json(
    path: str,
    payload: dict[str, Any],
    *,
    timeout: int = 180,
) -> dict[str, Any]:
    base_url, token = configuration()
    request = urllib.request.Request(
        f"{base_url}{path}",
        data=json.dumps(payload).encode("utf-8"),
        method="POST",
        headers={
            "authorization": f"Bearer {token}",
            "content-type": "application/json",
            "user-agent": "transcript-commons/2.0",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        detail = error.read().decode("utf-8", "replace")
        raise RuntimeError(
            f"Registry returned HTTP {error.code}: {detail}"
        ) from error


def registry_record(record: dict[str, Any]) -> dict[str, Any]:
    segments = [
        {
            "start": float(segment.get("start") or 0),
            "end": float(segment.get("start") or 0)
            + float(segment.get("duration") or 0),
            "text": str(segment.get("text") or "").strip(),
        }
        for segment in record.get("segments") or []
        if str(segment.get("text") or "").strip()
    ]
    transcript_source = {
        "auto-captions": "automatic-captions",
        "creator-captions": "creator-captions",
        "local-asr": "local-asr",
    }.get(str(record.get("transcriptSource")), "local-asr")
    video_id = str(record.get("videoId") or "")
    channel = str(record.get("channel") or "")
    return {
        "provider": "youtube",
        "providerId": video_id,
        "sourceUrl": str(record.get("sourceUrl") or "")
        or f"https://www.youtube.com/watch?v={video_id}",
        "title": str(record.get("title") or video_id),
        "channel": channel,
        "channelUrl": str(record.get("channelUrl") or "") or None,
        "description": str(record.get("description") or ""),
        "publishedAt": str(record.get("publishedAt") or "") or None,
        "durationSeconds": int(record.get("durationSeconds") or 0) or None,
        "language": str(record.get("language") or "en"),
        "transcriptSource": transcript_source,
        "license": str(record.get("license") or "unknown"),
        "attribution": str(record.get("attribution") or "")
        or f"{channel} — original YouTube source linked above.",
        "topics": [str(topic) for topic in record.get("topics") or []],
        "transcriptText": " ".join(
            segment["text"] for segment in segments
        ),
        "segments": segments,
    }
