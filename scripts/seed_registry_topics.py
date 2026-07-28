#!/usr/bin/env python3
"""Queue a broad, deduplicated topic catalog in Transcript Registry."""

from __future__ import annotations

import argparse
from pathlib import Path

from registry_api import ROOT, request_json


def read_topics(path: Path) -> list[str]:
    return [
        line.strip()
        for line in path.read_text("utf-8").splitlines()
        if line.strip() and not line.lstrip().startswith("#")
    ]


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--file",
        type=Path,
        default=ROOT / "topics" / "broad-topics.txt",
    )
    parser.add_argument("--max-topics", type=int)
    parser.add_argument("--target-count", type=int, default=8)
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()
    topics = read_topics(args.file)
    if args.max_topics is not None:
        topics = topics[: max(0, args.max_topics)]
    accepted = 0
    for offset in range(0, len(topics), 50):
        batch = topics[offset : offset + 50]
        result = request_json(
            "/api/admin/topics",
            {
                "topics": batch,
                "targetCount": args.target_count,
                "force": args.force,
            },
        )
        accepted += int(result.get("accepted") or 0)
        print(f"queued {accepted}/{len(topics)}", flush=True)
    return 0 if accepted == len(topics) else 1


if __name__ == "__main__":
    raise SystemExit(main())
