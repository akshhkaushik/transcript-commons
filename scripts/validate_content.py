#!/usr/bin/env python3
"""Validate the published transcript collection before building or deploying."""

from __future__ import annotations

import sys

from transcript_pipeline import DATA_FILE, load_records, transcript_hash, validate_record


def main() -> int:
    records = load_records()
    errors: list[str] = []
    seen: set[str] = set()

    for record in records:
        video_id = str(record.get("videoId") or "<missing>")
        if video_id in seen:
            errors.append(f"{video_id}: duplicate videoId")
        seen.add(video_id)
        errors.extend(f"{video_id}: {error}" for error in validate_record(record))

        expected_hash = (
            record.get("provenance", {}).get("contentSha256")
            if isinstance(record.get("provenance"), dict)
            else None
        )
        if expected_hash and expected_hash != transcript_hash(record["segments"]):
            errors.append(f"{video_id}: transcript content hash does not match")

    if errors:
        print(f"{DATA_FILE}: validation failed", file=sys.stderr)
        for error in errors:
            print(f"- {error}", file=sys.stderr)
        return 1

    print(f"Validated {len(records)} transcript record(s).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
