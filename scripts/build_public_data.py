#!/usr/bin/env python3
"""Generate deterministic public transcript objects, status, and a BM25 search index."""

from __future__ import annotations

import json
import re
from collections import Counter
from pathlib import Path
from typing import Any, Iterable

try:
    from transcript_pipeline import ROOT, load_records, transcript_word_count
except ModuleNotFoundError:  # Imported as scripts.build_public_data in tests.
    from scripts.transcript_pipeline import ROOT, load_records, transcript_word_count

CANONICAL_ORIGIN = "https://transcript-commons.vercel.app"
CONTENT_DIR = ROOT / "content"
PUBLIC_DATA_DIR = ROOT / "public" / "data"
TRANSCRIPT_OBJECTS_DIR = PUBLIC_DATA_DIR / "transcripts"
SEARCH_INDEX_FILE = CONTENT_DIR / "search-index.json"
STATUS_FILE = CONTENT_DIR / "library-status.json"

STOP_WORDS = {
    "a",
    "an",
    "and",
    "are",
    "as",
    "at",
    "be",
    "been",
    "but",
    "by",
    "for",
    "from",
    "had",
    "has",
    "have",
    "he",
    "her",
    "his",
    "i",
    "in",
    "is",
    "it",
    "its",
    "of",
    "on",
    "or",
    "our",
    "she",
    "that",
    "the",
    "their",
    "they",
    "this",
    "to",
    "was",
    "we",
    "were",
    "will",
    "with",
    "you",
    "your",
}


def tokenize(value: str) -> list[str]:
    return [
        token
        for token in re.findall(r"[a-z0-9]+(?:'[a-z0-9]+)?", value.casefold())
        if len(token) > 1 and token not in STOP_WORDS
    ]


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n",
        encoding="utf-8",
    )


def timestamp(seconds: float) -> str:
    whole = max(0, int(seconds))
    hours, remainder = divmod(whole, 3600)
    minutes, secs = divmod(remainder, 60)
    if hours:
        return f"{hours}:{minutes:02d}:{secs:02d}"
    return f"{minutes}:{secs:02d}"


def transcript_text(record: dict[str, Any]) -> str:
    return "\n\n".join(
        f"[{timestamp(float(segment['start']))}] {segment['text']}"
        for segment in record["segments"]
    )


def parse_queue_line(line: str) -> dict[str, str] | None:
    value = line.strip()
    if not value or value.startswith("#"):
        return None
    url, _, comment = value.partition(" #")
    match = re.search(r"(?:v=|youtu\.be/)([A-Za-z0-9_-]{11})", url)
    if not match:
        return None
    title, _, channel = comment.partition(" — ")
    return {
        "videoId": match.group(1),
        "url": url.strip(),
        "title": title.strip(),
        "channel": channel.strip(),
    }


def queued_items(queue_paths: Iterable[Path]) -> list[dict[str, str]]:
    items: dict[str, dict[str, str]] = {}
    for path in sorted(queue_paths):
        for line in path.read_text(encoding="utf-8").splitlines():
            item = parse_queue_line(line)
            if item:
                items.setdefault(item["videoId"], item)
    return sorted(items.values(), key=lambda item: item["videoId"])


def build_search_index(records: list[dict[str, Any]]) -> dict[str, Any]:
    documents: list[dict[str, Any]] = []
    postings: dict[str, list[list[int]]] = {}

    for record in records:
        metadata = " ".join(
            [
                str(record.get("title") or ""),
                str(record.get("channel") or ""),
                str(record.get("description") or ""),
                " ".join(str(topic) for topic in record.get("topics") or []),
            ]
        )
        source_documents = [
            {
                "videoId": record["videoId"],
                "segmentIndex": -1,
                "start": 0,
                "field": "metadata",
                "text": metadata,
            },
            *[
                {
                    "videoId": record["videoId"],
                    "segmentIndex": index,
                    "start": float(segment["start"]),
                    "field": "transcript",
                    "text": str(segment["text"]),
                }
                for index, segment in enumerate(record["segments"])
            ],
        ]
        for document in source_documents:
            tokens = tokenize(document["text"])
            document_index = len(documents)
            documents.append(
                {
                    **document,
                    "length": max(1, len(tokens)),
                }
            )
            for term, frequency in Counter(tokens).items():
                postings.setdefault(term, []).append([document_index, frequency])

    average_length = (
        sum(document["length"] for document in documents) / len(documents)
        if documents
        else 0
    )
    return {
        "version": 1,
        "generatedAt": max(
            (str(record.get("ingestedAt") or "") for record in records), default=""
        ),
        "algorithm": "BM25",
        "documentCount": len(documents),
        "averageDocumentLength": round(average_length, 4),
        "documents": documents,
        "postings": dict(sorted(postings.items())),
    }


def build_status(
    records: list[dict[str, Any]], queue: list[dict[str, str]]
) -> dict[str, Any]:
    published_ids = {str(record["videoId"]) for record in records}
    source_counts = Counter(str(record["transcriptSource"]) for record in records)
    review_counts = Counter(
        str(record.get("reviewStatus") or "unreviewed") for record in records
    )
    pending = [item for item in queue if item["videoId"] not in published_ids]
    return {
        "version": 1,
        "generatedAt": max(
            (str(record.get("ingestedAt") or "") for record in records), default=""
        ),
        "canonicalOrigin": CANONICAL_ORIGIN,
        "publishedCount": len(records),
        "queuedCount": len(queue),
        "pendingCount": len(pending),
        "totalDurationSeconds": sum(
            int(record.get("durationSeconds") or 0) for record in records
        ),
        "totalWordCount": sum(
            int((record.get("quality") or {}).get("wordCount") or 0)
            or transcript_word_count(record["segments"])
            for record in records
        ),
        "sourceCounts": dict(sorted(source_counts.items())),
        "reviewCounts": dict(sorted(review_counts.items())),
        "pending": pending,
    }


def generate(
    *,
    records: list[dict[str, Any]] | None = None,
    queue_paths: Iterable[Path] | None = None,
) -> dict[str, Any]:
    records = records if records is not None else load_records()
    queue_paths = (
        list(queue_paths)
        if queue_paths is not None
        else list((ROOT / "queues").glob("*.txt"))
    )
    queue = queued_items(queue_paths)
    TRANSCRIPT_OBJECTS_DIR.mkdir(parents=True, exist_ok=True)

    expected_files: set[Path] = set()
    library_records: list[dict[str, Any]] = []
    for record in records:
        video_id = str(record["videoId"])
        json_path = TRANSCRIPT_OBJECTS_DIR / f"{video_id}.json"
        text_path = TRANSCRIPT_OBJECTS_DIR / f"{video_id}.txt"
        write_json(
            json_path,
            {
                "$schema": f"{CANONICAL_ORIGIN}/transcript-schema.json",
                **record,
            },
        )
        text_path.write_text(
            f"{record['title']}\n"
            f"Channel: {record['channel']}\n"
            f"Source: {record['sourceUrl']}\n"
            f"Canonical transcript: {CANONICAL_ORIGIN}/videos/{video_id}\n\n"
            f"{transcript_text(record)}\n",
            encoding="utf-8",
        )
        expected_files.update({json_path, text_path})
        library_records.append(
            {
                "videoId": video_id,
                "title": record["title"],
                "channel": record["channel"],
                "topics": record["topics"],
                "transcriptSource": record["transcriptSource"],
                "reviewStatus": record.get("reviewStatus", "unreviewed"),
                "durationSeconds": record["durationSeconds"],
                "wordCount": int((record.get("quality") or {}).get("wordCount") or 0)
                or transcript_word_count(record["segments"]),
                "transcriptUrl": f"{CANONICAL_ORIGIN}/videos/{video_id}",
                "jsonObjectUrl": f"{CANONICAL_ORIGIN}/data/transcripts/{video_id}.json",
                "textObjectUrl": f"{CANONICAL_ORIGIN}/data/transcripts/{video_id}.txt",
                "sourceUrl": record["sourceUrl"],
            }
        )

    for path in TRANSCRIPT_OBJECTS_DIR.glob("*"):
        if path.is_file() and path not in expected_files:
            path.unlink()

    search_index = build_search_index(records)
    status = build_status(records, queue)
    write_json(SEARCH_INDEX_FILE, search_index)
    write_json(PUBLIC_DATA_DIR / "search-index.json", search_index)
    write_json(STATUS_FILE, status)
    write_json(
        PUBLIC_DATA_DIR / "library.json",
        {
            "version": 1,
            "generatedAt": status["generatedAt"],
            "count": len(library_records),
            "records": library_records,
        },
    )
    write_json(PUBLIC_DATA_DIR / "status.json", status)
    return {
        "records": len(records),
        "documents": search_index["documentCount"],
        "terms": len(search_index["postings"]),
        "pending": status["pendingCount"],
    }


def main() -> int:
    summary = generate()
    print(
        "Generated public data for "
        f"{summary['records']} transcript(s), {summary['documents']} search documents, "
        f"{summary['terms']} terms, and {summary['pending']} pending queue item(s)."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
