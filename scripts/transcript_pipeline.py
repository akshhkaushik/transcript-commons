#!/usr/bin/env python3
"""Shared ingestion, normalization, and validation helpers for Transcript Commons."""

from __future__ import annotations

import hashlib
import html
import json
import re
import shutil
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable
from urllib.parse import parse_qs, urlparse

ROOT = Path(__file__).resolve().parents[1]
DATA_FILE = ROOT / "content" / "transcripts.json"
PIPELINE_VERSION = "1.0.0"

HEALTHCARE_TOPICS: dict[str, tuple[str, ...]] = {
    "Diabetes": ("diabetes", "diabetic", "insulin", "a1c", "blood sugar", "glucose"),
    "Cardiology": (
        "cardiology",
        "cardiovascular",
        "heart disease",
        "heart health",
        "hypertension",
        "blood pressure",
        "cholesterol",
    ),
    "Cancer": ("cancer", "oncology", "tumor", "chemotherapy", "radiation therapy"),
    "Mental Health": (
        "mental health",
        "depression",
        "anxiety",
        "psychiatry",
        "psychology",
        "stress",
    ),
    "Neurology": (
        "neurology",
        "brain health",
        "stroke",
        "dementia",
        "alzheimer",
        "parkinson",
        "migraine",
    ),
    "Nutrition": ("nutrition", "diet", "food", "vitamin", "metabolism", "obesity"),
    "Infectious Disease": (
        "infectious disease",
        "infection",
        "virus",
        "bacteria",
        "covid",
        "vaccine",
    ),
    "Public Health": (
        "public health",
        "health policy",
        "medicare",
        "health equity",
        "prevention",
        "screening",
    ),
    "Pediatrics": ("pediatric", "children's health", "child health", "newborn"),
    "Women's Health": (
        "women's health",
        "pregnancy",
        "maternal",
        "menopause",
        "gynecology",
    ),
}


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def run(
    command: list[str],
    *,
    capture: bool = False,
    timeout: int | None = None,
) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        command,
        check=True,
        text=True,
        capture_output=capture,
        timeout=timeout,
    )


def find_binary(name: str, override: str | None = None) -> str:
    candidate = override or shutil.which(name)
    if not candidate:
        raise RuntimeError(
            f"Could not find {name}. Install it or provide its path with the matching CLI option."
        )
    return candidate


def yt_dlp_base_args(cookies_from_browser: str | None = None) -> list[str]:
    args = ["--no-playlist", "--no-warnings"]
    if cookies_from_browser:
        args.extend(["--cookies-from-browser", cookies_from_browser])
    return args


def metadata_for(
    yt_dlp: str,
    url: str,
    *,
    cookies_from_browser: str | None = None,
) -> dict[str, Any]:
    result = run(
        [
            yt_dlp,
            "--dump-single-json",
            "--skip-download",
            *yt_dlp_base_args(cookies_from_browser),
            url,
        ],
        capture=True,
        timeout=180,
    )
    return json.loads(result.stdout)


def youtube_video_id(value: str) -> str | None:
    parsed = urlparse(value)
    hostname = parsed.hostname.lower() if parsed.hostname else ""
    if hostname in {"youtu.be", "www.youtu.be"}:
        return parsed.path.strip("/").split("/")[0] or None
    if hostname.endswith("youtube.com"):
        if parsed.path == "/watch":
            return parse_qs(parsed.query).get("v", [None])[0]
        for prefix in ("/shorts/", "/embed/", "/live/"):
            if parsed.path.startswith(prefix):
                return parsed.path[len(prefix) :].split("/")[0] or None
    if re.fullmatch(r"[\w-]{11}", value):
        return value
    return None


def canonical_youtube_url(video_id: str) -> str:
    return f"https://www.youtube.com/watch?v={video_id}"


def normalize_text(value: str) -> str:
    text = html.unescape(value)
    text = text.replace("\u200b", "").replace("\ufeff", "")
    return re.sub(r"\s+", " ", text).strip()


def _word_overlap(left: str, right: str, *, maximum: int = 16) -> int:
    left_words = left.split()
    right_words = right.split()
    for size in range(min(maximum, len(left_words), len(right_words)), 1, -1):
        if [word.casefold() for word in left_words[-size:]] == [
            word.casefold() for word in right_words[:size]
        ]:
            return size
    return 0


def normalize_segments(
    segments: Iterable[dict[str, Any]],
    *,
    coalesce: bool = True,
) -> list[dict[str, Any]]:
    """Remove rolling-caption duplication and form readable timestamped blocks."""

    cleaned: list[dict[str, Any]] = []
    for item in sorted(segments, key=lambda value: float(value.get("start", 0))):
        text = normalize_text(str(item.get("text", "")))
        if not text:
            continue
        start = max(0.0, float(item.get("start", 0)))
        duration = max(0.05, float(item.get("duration", 0)))
        end = start + duration

        if cleaned:
            previous = cleaned[-1]
            previous_text = str(previous["text"])
            previous_end = float(previous["start"]) + float(previous["duration"])
            close_in_time = start <= previous_end + 1.5

            if text.casefold() == previous_text.casefold():
                previous["duration"] = round(max(previous_end, end) - previous["start"], 3)
                continue

            if close_in_time and text.casefold().startswith(previous_text.casefold()):
                previous["text"] = text
                previous["duration"] = round(max(previous_end, end) - previous["start"], 3)
                continue

            if close_in_time and previous_text.casefold().startswith(text.casefold()):
                previous["duration"] = round(max(previous_end, end) - previous["start"], 3)
                continue

            overlap = _word_overlap(previous_text, text) if close_in_time else 0
            if overlap:
                text = " ".join(text.split()[overlap:]).strip()
                if not text:
                    previous["duration"] = round(
                        max(previous_end, end) - previous["start"], 3
                    )
                    continue

        cleaned.append(
            {
                "start": round(start, 3),
                "duration": round(duration, 3),
                "text": text,
            }
        )

    if not coalesce:
        return cleaned

    blocks: list[dict[str, Any]] = []
    for segment in cleaned:
        if not blocks:
            blocks.append(segment.copy())
            continue

        previous = blocks[-1]
        previous_end = float(previous["start"]) + float(previous["duration"])
        segment_end = float(segment["start"]) + float(segment["duration"])
        gap = float(segment["start"]) - previous_end
        combined_text = f"{previous['text']} {segment['text']}".strip()
        combined_duration = segment_end - float(previous["start"])

        if gap <= 1.25 and combined_duration <= 18 and len(combined_text) <= 340:
            previous["text"] = combined_text
            previous["duration"] = round(combined_duration, 3)
        else:
            blocks.append(segment.copy())

    return blocks


def parse_json3(path: Path) -> list[dict[str, Any]]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    raw_segments: list[dict[str, Any]] = []
    for event in payload.get("events", []):
        parts = event.get("segs")
        if not parts:
            continue
        text = "".join(str(part.get("utf8", "")) for part in parts)
        raw_segments.append(
            {
                "start": float(event.get("tStartMs", 0)) / 1000,
                "duration": float(event.get("dDurationMs", 0)) / 1000,
                "text": text,
            }
        )
    return normalize_segments(raw_segments)


def _language_rank(candidate: str, requested: str) -> tuple[int, int, str]:
    candidate_folded = candidate.casefold()
    requested_folded = requested.casefold()
    if candidate_folded == requested_folded:
        return (0, len(candidate), candidate)
    if candidate_folded.startswith(f"{requested_folded}-"):
        return (1, len(candidate), candidate)
    if candidate_folded.startswith(requested_folded):
        return (2, len(candidate), candidate)
    return (9, len(candidate), candidate)


def choose_caption_track(
    metadata: dict[str, Any],
    requested_language: str,
) -> dict[str, str] | None:
    """Prefer creator-provided captions, then automatic captions."""

    for metadata_key, source in (
        ("subtitles", "creator-captions"),
        ("automatic_captions", "auto-captions"),
    ):
        tracks = metadata.get(metadata_key) or {}
        candidates = [
            language
            for language in tracks
            if language != "live_chat"
            and _language_rank(language, requested_language)[0] < 9
        ]
        if candidates:
            selected = min(
                candidates,
                key=lambda language: _language_rank(language, requested_language),
            )
            return {"language": selected, "source": source}
    return None


def iso_date(raw_date: str | None) -> str:
    if not raw_date:
        return ""
    if re.fullmatch(r"\d{8}", raw_date):
        return f"{raw_date[:4]}-{raw_date[4:6]}-{raw_date[6:]}"
    return raw_date


def infer_topics(
    metadata: dict[str, Any],
    explicit_topics: Iterable[str] = (),
) -> list[str]:
    searchable = " ".join(
        [
            str(metadata.get("title") or ""),
            str(metadata.get("description") or ""),
            " ".join(str(value) for value in metadata.get("tags") or []),
            " ".join(str(value) for value in metadata.get("categories") or []),
        ]
    ).casefold()

    topics: list[str] = []
    for topic in explicit_topics:
        cleaned = normalize_text(topic)
        if cleaned and cleaned.casefold() not in {value.casefold() for value in topics}:
            topics.append(cleaned)

    for topic, keywords in HEALTHCARE_TOPICS.items():
        if any(keyword in searchable for keyword in keywords):
            if topic.casefold() not in {value.casefold() for value in topics}:
                topics.append(topic)
        if len(topics) >= 8:
            break

    for candidate in (metadata.get("categories") or []) + (metadata.get("tags") or []):
        cleaned = normalize_text(str(candidate))
        if (
            cleaned
            and len(cleaned) <= 48
            and re.search(r"[A-Za-z]", cleaned)
            and cleaned.casefold() not in {value.casefold() for value in topics}
        ):
            topics.append(cleaned)
        if len(topics) >= 8:
            break

    return topics or ["Healthcare"]


def transcript_hash(segments: Iterable[dict[str, Any]]) -> str:
    normalized = "\n".join(
        f"{float(segment['start']):.3f}\t{normalize_text(str(segment['text']))}"
        for segment in segments
    )
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()


def transcript_word_count(segments: Iterable[dict[str, Any]]) -> int:
    return sum(len(str(segment.get("text", "")).split()) for segment in segments)


def quality_report(
    segments: list[dict[str, Any]],
    *,
    duration_seconds: int,
    transcript_source: str,
) -> dict[str, Any]:
    warnings: list[str] = []
    word_count = transcript_word_count(segments)
    if word_count < 40:
        warnings.append("Transcript is unusually short and should be reviewed.")
    if transcript_source in {"auto-captions", "local-asr"}:
        warnings.append("Automated transcript; verify medical names, dosages, and numbers.")
    if segments and duration_seconds:
        transcript_end = max(
            float(item["start"]) + float(item["duration"]) for item in segments
        )
        if transcript_end < duration_seconds * 0.5:
            warnings.append("Transcript covers less than half of the source duration.")
    return {
        "segmentCount": len(segments),
        "wordCount": word_count,
        "warnings": warnings,
    }


def validate_record(record: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    required = (
        "videoId",
        "title",
        "channel",
        "sourceUrl",
        "durationSeconds",
        "language",
        "topics",
        "transcriptSource",
        "segments",
    )
    for key in required:
        if key not in record:
            errors.append(f"missing required field: {key}")

    video_id = str(record.get("videoId") or "")
    if not re.fullmatch(r"[\w-]{11}", video_id):
        errors.append("videoId must be an 11-character YouTube identifier")

    source_id = youtube_video_id(str(record.get("sourceUrl") or ""))
    if source_id and video_id and source_id != video_id:
        errors.append("sourceUrl video ID does not match videoId")

    segments = record.get("segments")
    if not isinstance(segments, list) or not segments:
        errors.append("segments must be a non-empty list")
        return errors

    previous_start = -1.0
    for index, segment in enumerate(segments):
        try:
            start = float(segment["start"])
            duration = float(segment["duration"])
            text = normalize_text(str(segment["text"]))
        except (KeyError, TypeError, ValueError):
            errors.append(f"segment {index} is malformed")
            continue
        if start < previous_start:
            errors.append(f"segment {index} is out of chronological order")
        if start < 0:
            errors.append(f"segment {index} has a negative start")
        if duration <= 0:
            errors.append(f"segment {index} has a non-positive duration")
        if not text:
            errors.append(f"segment {index} has empty text")
        previous_start = start
    return errors


def load_records(path: Path = DATA_FILE) -> list[dict[str, Any]]:
    if not path.exists():
        return []
    payload = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(payload, list):
        raise RuntimeError(f"{path} must contain a JSON array.")
    return payload


def save_record(record: dict[str, Any], path: Path = DATA_FILE) -> None:
    errors = validate_record(record)
    if errors:
        raise RuntimeError("Invalid transcript record: " + "; ".join(errors))
    records = [
        item for item in load_records(path) if item.get("videoId") != record["videoId"]
    ]
    records.append(record)
    records.sort(key=lambda item: str(item.get("ingestedAt") or ""), reverse=True)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(records, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
