#!/usr/bin/env python3
"""Captions-first YouTube transcript ingestion for Transcript Commons."""

from __future__ import annotations

import argparse
import html
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
DATA_FILE = ROOT / "content" / "transcripts.json"


def run(command: list[str], *, capture: bool = False) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        command,
        check=True,
        text=True,
        capture_output=capture,
    )


def find_binary(name: str, override: str | None = None) -> str:
    candidate = override or shutil.which(name)
    if not candidate:
        raise RuntimeError(
            f"Could not find {name}. Install it or provide its path with the matching CLI option."
        )
    return candidate


def metadata_for(yt_dlp: str, url: str) -> dict[str, Any]:
    result = run(
        [
            yt_dlp,
            "--dump-single-json",
            "--skip-download",
            "--no-playlist",
            url,
        ],
        capture=True,
    )
    return json.loads(result.stdout)


def parse_json3(path: Path) -> list[dict[str, Any]]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    segments: list[dict[str, Any]] = []

    for event in payload.get("events", []):
        parts = event.get("segs")
        if not parts:
            continue
        text = "".join(part.get("utf8", "") for part in parts)
        text = html.unescape(re.sub(r"\s+", " ", text)).strip()
        if not text or text == "\n":
            continue

        start = float(event.get("tStartMs", 0)) / 1000
        duration = float(event.get("dDurationMs", 0)) / 1000
        if segments and text == segments[-1]["text"]:
            continue
        segments.append(
            {
                "start": round(start, 3),
                "duration": round(duration, 3),
                "text": text,
            }
        )

    return segments


def fetch_captions(
    yt_dlp: str, url: str, language: str, workdir: Path
) -> tuple[list[dict[str, Any]], str] | None:
    output = workdir / "%(id)s.%(ext)s"
    run(
        [
            yt_dlp,
            "--skip-download",
            "--no-playlist",
            "--write-subs",
            "--write-auto-subs",
            "--sub-langs",
            f"{language},{language}.*",
            "--sub-format",
            "json3",
            "-o",
            str(output),
            url,
        ]
    )

    caption_files = sorted(workdir.glob("*.json3"))
    if not caption_files:
        return None

    chosen = caption_files[0]
    source = "auto-captions" if ".orig." not in chosen.name else "creator-captions"
    return parse_json3(chosen), source


def download_audio(yt_dlp: str, url: str, workdir: Path) -> Path:
    output = workdir / "%(id)s.%(ext)s"
    run(
        [
            yt_dlp,
            "--no-playlist",
            "-x",
            "--audio-format",
            "wav",
            "--audio-quality",
            "0",
            "-o",
            str(output),
            url,
        ]
    )
    audio_files = list(workdir.glob("*.wav"))
    if not audio_files:
        raise RuntimeError("yt-dlp completed but did not produce a WAV file.")
    return audio_files[0]


def transcribe_mlx(audio: Path, language: str, model: str) -> list[dict[str, Any]]:
    try:
        import mlx_whisper  # type: ignore
    except ImportError as exc:
        raise RuntimeError(
            "mlx-whisper is not installed. Run: python3 -m pip install mlx-whisper"
        ) from exc

    result = mlx_whisper.transcribe(
        str(audio),
        path_or_hf_repo=model,
        language=language,
        word_timestamps=False,
    )
    return [
        {
            "start": round(float(segment["start"]), 3),
            "duration": round(float(segment["end"]) - float(segment["start"]), 3),
            "text": str(segment["text"]).strip(),
        }
        for segment in result["segments"]
        if str(segment["text"]).strip()
    ]


def transcribe_whisper_cpp(
    binary: str, model_path: str, audio: Path, language: str, workdir: Path
) -> list[dict[str, Any]]:
    output_base = workdir / "whisper-output"
    run(
        [
            binary,
            "-m",
            model_path,
            "-f",
            str(audio),
            "-l",
            language,
            "-oj",
            "-of",
            str(output_base),
        ]
    )
    payload = json.loads(output_base.with_suffix(".json").read_text(encoding="utf-8"))
    return [
        {
            "start": round(float(item["offsets"]["from"]) / 1000, 3),
            "duration": round(
                (float(item["offsets"]["to"]) - float(item["offsets"]["from"])) / 1000,
                3,
            ),
            "text": str(item["text"]).strip(),
        }
        for item in payload.get("transcription", [])
        if str(item.get("text", "")).strip()
    ]


def infer_topics(metadata: dict[str, Any]) -> list[str]:
    candidates = metadata.get("categories", []) + metadata.get("tags", [])
    topics: list[str] = []
    for candidate in candidates:
        cleaned = str(candidate).strip()
        if cleaned and cleaned.lower() not in {topic.lower() for topic in topics}:
            topics.append(cleaned)
        if len(topics) == 6:
            break
    return topics or ["Healthcare"]


def iso_date(raw_date: str | None) -> str:
    if not raw_date:
        return ""
    if re.fullmatch(r"\d{8}", raw_date):
        return f"{raw_date[:4]}-{raw_date[4:6]}-{raw_date[6:]}"
    return raw_date


def save_record(record: dict[str, Any]) -> None:
    records = json.loads(DATA_FILE.read_text(encoding="utf-8"))
    records = [item for item in records if item["videoId"] != record["videoId"]]
    records.append(record)
    records.sort(key=lambda item: item["ingestedAt"], reverse=True)
    DATA_FILE.write_text(
        json.dumps(records, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def ingest(args: argparse.Namespace) -> None:
    yt_dlp = find_binary("yt-dlp", args.yt_dlp)
    metadata = metadata_for(yt_dlp, args.url)

    with tempfile.TemporaryDirectory(prefix="transcript-commons-") as temp:
        workdir = Path(temp)
        caption_result = None if args.force_local else fetch_captions(
            yt_dlp, args.url, args.language, workdir
        )

        model_used = None
        if caption_result and caption_result[0]:
            segments, transcript_source = caption_result
        else:
            audio = download_audio(yt_dlp, args.url, workdir)
            transcript_source = "local-asr"
            if args.engine == "mlx":
                model_used = args.model
                segments = transcribe_mlx(audio, args.language, args.model)
            else:
                whisper_cpp = find_binary("whisper-cli", args.whisper_cpp)
                if not args.whisper_cpp_model:
                    raise RuntimeError("--whisper-cpp-model is required with --engine whisper-cpp")
                model_used = Path(args.whisper_cpp_model).name
                segments = transcribe_whisper_cpp(
                    whisper_cpp,
                    args.whisper_cpp_model,
                    audio,
                    args.language,
                    workdir,
                )

    video_id = str(metadata["id"])
    record = {
        "videoId": video_id,
        "title": metadata.get("title") or video_id,
        "channel": metadata.get("channel") or metadata.get("uploader") or "Unknown",
        "channelUrl": metadata.get("channel_url") or metadata.get("uploader_url") or "",
        "sourceUrl": metadata.get("webpage_url") or args.url,
        "description": (metadata.get("description") or "").split("\n")[0][:360],
        "publishedAt": iso_date(metadata.get("upload_date")),
        "durationSeconds": int(metadata.get("duration") or 0),
        "language": args.language,
        "topics": infer_topics(metadata),
        "transcriptSource": transcript_source,
        "ingestedAt": datetime.now(timezone.utc).isoformat(),
        "segments": segments,
    }
    if model_used:
        record["model"] = model_used

    save_record(record)
    print(
        f"Added {record['title']} ({len(segments)} segments, {transcript_source})"
    )


def parser() -> argparse.ArgumentParser:
    command = argparse.ArgumentParser(
        description="Ingest one YouTube video into Transcript Commons."
    )
    command.add_argument("url")
    command.add_argument("--language", default="en")
    command.add_argument("--engine", choices=["mlx", "whisper-cpp"], default="mlx")
    command.add_argument(
        "--model",
        default="mlx-community/whisper-small-mlx",
        help="MLX Whisper model repository.",
    )
    command.add_argument("--force-local", action="store_true")
    command.add_argument("--yt-dlp", default=os.environ.get("YT_DLP_BINARY"))
    command.add_argument("--whisper-cpp", default=os.environ.get("WHISPER_CPP_BINARY"))
    command.add_argument(
        "--whisper-cpp-model", default=os.environ.get("WHISPER_CPP_MODEL")
    )
    return command


if __name__ == "__main__":
    try:
        ingest(parser().parse_args())
    except (RuntimeError, subprocess.CalledProcessError, KeyError) as error:
        print(f"error: {error}", file=sys.stderr)
        raise SystemExit(1)
