#!/usr/bin/env python3
"""Publish local Transcript Commons records into Transcript Registry."""

from __future__ import annotations

import argparse

from registry_api import registry_record, request_json
from transcript_pipeline import load_records


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--video-id", action="append", default=[])
    parser.add_argument("--batch-size", type=int, default=10)
    args = parser.parse_args()
    selected = set(args.video_id)
    records = [
        registry_record(record)
        for record in load_records()
        if not selected or str(record.get("videoId")) in selected
    ]
    if not records:
        raise SystemExit("No matching local transcripts")
    batch_size = max(1, min(args.batch_size, 20))
    imported = 0
    for offset in range(0, len(records), batch_size):
        batch = records[offset : offset + batch_size]
        result = request_json("/api/admin/import", {"records": batch})
        imported += int(result.get("imported") or 0)
        print(f"published {imported}/{len(records)}", flush=True)
    return 0 if imported == len(records) else 1


if __name__ == "__main__":
    raise SystemExit(main())
