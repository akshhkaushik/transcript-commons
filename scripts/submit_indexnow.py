#!/usr/bin/env python3
"""Notify IndexNow participants about canonical Transcript Commons pages."""

from __future__ import annotations

import argparse
import json
import urllib.error
import urllib.request
from typing import Any

try:
    from transcript_pipeline import load_records
except ModuleNotFoundError:
    from scripts.transcript_pipeline import load_records

DEFAULT_ORIGIN = "https://transcript-commons.vercel.app"
INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow"
INDEXNOW_KEY = "223e7f0ebabd2f971595536b545c9533"


def canonical_urls(records: list[dict[str, Any]], origin: str) -> list[str]:
    root = origin.rstrip("/")
    urls = [
        f"{root}/",
        f"{root}/status",
        f"{root}/policies",
        f"{root}/llms.txt",
        f"{root}/sitemap.xml",
    ]
    urls.extend(f"{root}/videos/{record['videoId']}" for record in records)
    return urls


def payload(records: list[dict[str, Any]], origin: str) -> dict[str, Any]:
    root = origin.rstrip("/")
    return {
        "host": root.removeprefix("https://").removeprefix("http://"),
        "key": INDEXNOW_KEY,
        "keyLocation": f"{root}/{INDEXNOW_KEY}.txt",
        "urlList": canonical_urls(records, root),
    }


def submit(data: dict[str, Any], endpoint: str = INDEXNOW_ENDPOINT) -> int:
    request = urllib.request.Request(
        endpoint,
        data=json.dumps(data).encode("utf-8"),
        headers={
            "content-type": "application/json; charset=utf-8",
            "user-agent": "Transcript-Commons-Indexer/1.0",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            status = response.status
    except urllib.error.HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")
        raise RuntimeError(
            f"IndexNow rejected the submission with HTTP {error.code}: {detail}"
        ) from error
    if status not in {200, 202}:
        raise RuntimeError(f"Unexpected IndexNow response: HTTP {status}")
    return status


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--origin", default=DEFAULT_ORIGIN)
    parser.add_argument("--submit", action="store_true")
    args = parser.parse_args()
    data = payload(load_records(), args.origin)
    if not args.submit:
        print(json.dumps(data, indent=2))
        return 0
    status = submit(data)
    print(
        f"IndexNow accepted {len(data['urlList'])} canonical URL(s) "
        f"with HTTP {status}."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
