#!/usr/bin/env python3
"""List and update Transcript Commons medical transcript review work."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

try:
    from transcript_pipeline import (
        DATA_FILE,
        PIPELINE_VERSION,
        load_records,
        save_record,
        transcript_hash,
        transcript_word_count,
        utc_now,
    )
except ModuleNotFoundError:  # Imported as scripts.review_queue in unit tests.
    from scripts.transcript_pipeline import (
        DATA_FILE,
        PIPELINE_VERSION,
        load_records,
        save_record,
        transcript_hash,
        transcript_word_count,
        utc_now,
    )

AUTOMATED_WARNING = (
    "Automated transcript; verify medical names, dosages, and numbers."
)


def review_items(
    records: list[dict[str, Any]], *, include_source_captions: bool = False
) -> list[dict[str, Any]]:
    accepted = {"automated-unreviewed"}
    if include_source_captions:
        accepted.add("source-captions")
    return sorted(
        (record for record in records if record.get("reviewStatus") in accepted),
        key=lambda record: (
            0 if record.get("reviewStatus") == "automated-unreviewed" else 1,
            str(record.get("channel") or ""),
            str(record.get("title") or ""),
        ),
    )


def summarize(record: dict[str, Any]) -> dict[str, Any]:
    provenance = record.get("provenance") or {}
    return {
        "videoId": record["videoId"],
        "title": record["title"],
        "channel": record["channel"],
        "sourceUrl": record["sourceUrl"],
        "reviewStatus": record.get("reviewStatus", "unreviewed"),
        "transcriptSource": record["transcriptSource"],
        "model": record.get("model") or provenance.get("model"),
        "wordCount": (record.get("quality") or {}).get("wordCount")
        or transcript_word_count(record.get("segments") or []),
        "warnings": (record.get("quality") or {}).get("warnings") or [],
    }


def mark_reviewed(
    records: list[dict[str, Any]],
    *,
    video_id: str,
    reviewer: str,
    notes: str | None = None,
    path: Path = DATA_FILE,
) -> dict[str, Any]:
    record = next(
        (item for item in records if str(item.get("videoId")) == video_id),
        None,
    )
    if record is None:
        raise RuntimeError(f"Transcript not found: {video_id}")

    updated = dict(record)
    updated["reviewStatus"] = "reviewed"
    updated["reviewedAt"] = utc_now()
    updated["reviewedBy"] = reviewer.strip()
    if notes and notes.strip():
        updated["reviewNotes"] = notes.strip()
    quality = dict(updated.get("quality") or {})
    quality["warnings"] = [
        warning
        for warning in quality.get("warnings") or []
        if warning != AUTOMATED_WARNING
    ]
    updated["quality"] = quality
    provenance = dict(updated.get("provenance") or {})
    provenance["pipelineVersion"] = PIPELINE_VERSION
    provenance["contentSha256"] = transcript_hash(updated["segments"])
    updated["provenance"] = provenance
    save_record(updated, path)
    return updated


def markdown(items: list[dict[str, Any]]) -> str:
    lines = [
        "# Transcript review queue",
        "",
        "Verify speaker names, medical terminology, dosages, numerical claims, and timestamps against the linked source.",
        "",
    ]
    for index, record in enumerate(items, start=1):
        item = summarize(record)
        lines.extend(
            [
                f"## {index}. {item['title']}",
                "",
                f"- Video ID: `{item['videoId']}`",
                f"- Channel: {item['channel']}",
                f"- Status: `{item['reviewStatus']}`",
                f"- Source: `{item['transcriptSource']}`",
                f"- Model: `{item['model'] or 'n/a'}`",
                f"- Words: {item['wordCount']}",
                f"- [Open source video]({item['sourceUrl']})",
                "",
            ]
        )
    if not items:
        lines.append("No transcripts currently require review.")
    return "\n".join(lines).rstrip() + "\n"


def table(items: list[dict[str, Any]]) -> str:
    if not items:
        return "No transcripts currently require review.\n"
    rows = []
    for record in items:
        item = summarize(record)
        rows.append(
            f"{item['videoId']}  {item['reviewStatus']:<22} "
            f"{item['wordCount']:>6} words  {item['title']}"
        )
    return "\n".join(rows) + "\n"


def main() -> int:
    parser = argparse.ArgumentParser(
        description="List transcript review work or mark a transcript reviewed."
    )
    parser.add_argument("--data-file", type=Path, default=DATA_FILE)
    parser.add_argument("--include-source-captions", action="store_true")
    parser.add_argument("--format", choices=["table", "json", "markdown"], default="table")
    parser.add_argument("--output", type=Path)
    parser.add_argument("--mark-reviewed", metavar="VIDEO_ID")
    parser.add_argument("--reviewer")
    parser.add_argument("--notes")
    args = parser.parse_args()

    records = load_records(args.data_file)
    if args.mark_reviewed:
        if not args.reviewer or not args.reviewer.strip():
            parser.error("--reviewer is required with --mark-reviewed")
        updated = mark_reviewed(
            records,
            video_id=args.mark_reviewed,
            reviewer=args.reviewer,
            notes=args.notes,
            path=args.data_file,
        )
        print(
            f"Marked {updated['videoId']} reviewed by {updated['reviewedBy']} "
            f"at {updated['reviewedAt']}."
        )
        return 0

    items = review_items(
        records, include_source_captions=args.include_source_captions
    )
    if args.format == "json":
        rendered = json.dumps([summarize(item) for item in items], indent=2) + "\n"
    elif args.format == "markdown":
        rendered = markdown(items)
    else:
        rendered = table(items)

    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(rendered, encoding="utf-8")
        print(f"Wrote {len(items)} review item(s) to {args.output}.")
    else:
        print(rendered, end="")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
