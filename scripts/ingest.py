#!/usr/bin/env python3
"""Captions-first YouTube transcript ingestion for Transcript Commons."""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import tempfile
import time
from pathlib import Path
from typing import Any

from transcript_pipeline import (
    PIPELINE_VERSION,
    canonical_youtube_url,
    choose_caption_track,
    find_binary,
    infer_topics,
    iso_date,
    load_records,
    metadata_for,
    normalize_segments,
    parse_json3,
    quality_report,
    run,
    save_record,
    transcript_hash,
    utc_now,
    yt_dlp_base_args,
)


def download_caption_track(
    yt_dlp: str,
    url: str,
    track: dict[str, str],
    workdir: Path,
    *,
    cookies_from_browser: str | None = None,
) -> list[dict[str, Any]]:
    output = workdir / "%(id)s.%(ext)s"
    source_args = (
        ["--write-subs", "--no-write-auto-subs"]
        if track["source"] == "creator-captions"
        else ["--no-write-subs", "--write-auto-subs"]
    )
    run(
        [
            yt_dlp,
            "--skip-download",
            *yt_dlp_base_args(cookies_from_browser),
            *source_args,
            "--sub-langs",
            track["language"],
            "--sub-format",
            "json3",
            "-o",
            str(output),
            url,
        ],
        timeout=180,
    )
    caption_files = sorted(workdir.glob("*.json3"))
    if not caption_files:
        raise RuntimeError(
            f"yt-dlp reported {track['source']} but did not produce a JSON3 caption file."
        )
    return parse_json3(caption_files[0])


def download_audio(
    yt_dlp: str,
    url: str,
    workdir: Path,
    *,
    cookies_from_browser: str | None = None,
) -> Path:
    output = workdir / "%(id)s.%(ext)s"
    run(
        [
            yt_dlp,
            *yt_dlp_base_args(cookies_from_browser),
            "-f",
            "bestaudio/best",
            "-x",
            "--audio-format",
            "wav",
            "--audio-quality",
            "0",
            "-o",
            str(output),
            url,
        ],
        timeout=1800,
    )
    audio_files = list(workdir.glob("*.wav"))
    if not audio_files:
        raise RuntimeError("yt-dlp completed but did not produce a WAV file.")
    return audio_files[0]


def transcribe_mlx(
    audio: Path,
    language: str,
    model: str,
) -> list[dict[str, Any]]:
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
        condition_on_previous_text=True,
    )
    return normalize_segments(
        [
            {
                "start": float(segment["start"]),
                "duration": float(segment["end"]) - float(segment["start"]),
                "text": str(segment["text"]),
            }
            for segment in result.get("segments", [])
        ]
    )


def transcribe_whisper_cpp(
    binary: str,
    model_path: str,
    audio: Path,
    language: str,
    workdir: Path,
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
        ],
        timeout=7200,
    )
    output_path = output_base.with_suffix(".json")
    if not output_path.exists():
        raise RuntimeError("whisper.cpp did not produce the requested JSON output.")
    payload = json.loads(output_path.read_text(encoding="utf-8"))
    return normalize_segments(
        [
            {
                "start": float(item["offsets"]["from"]) / 1000,
                "duration": (
                    float(item["offsets"]["to"]) - float(item["offsets"]["from"])
                )
                / 1000,
                "text": str(item["text"]),
            }
            for item in payload.get("transcription", [])
        ]
    )


def ingest(args: argparse.Namespace) -> dict[str, Any]:
    yt_dlp = find_binary("yt-dlp", args.yt_dlp)
    metadata_started = time.perf_counter()
    metadata = metadata_for(
        yt_dlp,
        args.url,
        cookies_from_browser=args.cookies_from_browser,
    )
    metadata_seconds = time.perf_counter() - metadata_started
    video_id = str(metadata["id"])

    if not args.refresh and any(
        record.get("videoId") == video_id for record in load_records()
    ):
        print(f"Already published: {metadata.get('title') or video_id}")
        return {"videoId": video_id, "skipped": True}

    started = time.perf_counter()
    selected_track = None if args.force_local else choose_caption_track(
        metadata, args.language
    )
    model_used = None
    engine_used = None
    caption_language = None

    with tempfile.TemporaryDirectory(prefix="transcript-commons-") as temp:
        workdir = Path(temp)
        if selected_track:
            try:
                segments = download_caption_track(
                    yt_dlp,
                    args.url,
                    selected_track,
                    workdir,
                    cookies_from_browser=args.cookies_from_browser,
                )
                transcript_source = selected_track["source"]
                caption_language = selected_track["language"]
            except (RuntimeError, subprocess.CalledProcessError) as error:
                if args.no_asr_fallback:
                    raise
                print(
                    f"caption download failed ({error}); falling back to local ASR",
                    file=sys.stderr,
                )
                selected_track = None

        if not selected_track:
            audio = download_audio(
                yt_dlp,
                args.url,
                workdir,
                cookies_from_browser=args.cookies_from_browser,
            )
            transcript_source = "local-asr"
            engine_used = args.engine
            if args.engine == "mlx":
                model_used = args.model
                segments = transcribe_mlx(audio, args.language, args.model)
            else:
                whisper_cpp = find_binary("whisper-cli", args.whisper_cpp)
                if not args.whisper_cpp_model:
                    raise RuntimeError(
                        "--whisper-cpp-model is required with --engine whisper-cpp"
                    )
                model_used = Path(args.whisper_cpp_model).name
                segments = transcribe_whisper_cpp(
                    whisper_cpp,
                    args.whisper_cpp_model,
                    audio,
                    args.language,
                    workdir,
                )

    duration_seconds = int(metadata.get("duration") or 0)
    processing_seconds = time.perf_counter() - started
    quality = quality_report(
        segments,
        duration_seconds=duration_seconds,
        transcript_source=transcript_source,
    )
    if quality["wordCount"] < args.min_words:
        raise RuntimeError(
            f"Transcript has only {quality['wordCount']} words; minimum is {args.min_words}."
        )

    source_url = canonical_youtube_url(video_id)
    fetched_at = utc_now()
    record: dict[str, Any] = {
        "schemaVersion": 1,
        "videoId": video_id,
        "title": metadata.get("title") or video_id,
        "channel": metadata.get("channel") or metadata.get("uploader") or "Unknown",
        "channelUrl": metadata.get("channel_url")
        or metadata.get("uploader_url")
        or "",
        "sourceUrl": source_url,
        "thumbnailUrl": metadata.get("thumbnail")
        or f"https://i.ytimg.com/vi/{video_id}/hqdefault.jpg",
        "description": (metadata.get("description") or "").split("\n")[0][:500],
        "publishedAt": iso_date(metadata.get("upload_date")),
        "durationSeconds": duration_seconds,
        "language": args.language,
        "topics": infer_topics(metadata, args.topic),
        "transcriptSource": transcript_source,
        "captionLanguage": caption_language,
        "ingestedAt": fetched_at,
        "reviewStatus": (
            "source-captions"
            if transcript_source == "creator-captions"
            else "automated-unreviewed"
        ),
        "quality": quality,
        "provenance": {
            "pipelineVersion": PIPELINE_VERSION,
            "fetchedAt": fetched_at,
            "method": transcript_source,
            "captionLanguage": caption_language,
            "engine": engine_used,
            "model": model_used,
            "contentSha256": transcript_hash(segments),
            "metadataSeconds": round(metadata_seconds, 3),
            "processingSeconds": round(processing_seconds, 3),
        },
        "rightsNote": (
            "Transcript provided for search and research with attribution to the "
            "source video. Source media rights remain with the original publisher."
        ),
        "segments": segments,
    }
    if model_used:
        record["model"] = model_used

    save_record(record)
    print(
        f"Added {record['title']} "
        f"({quality['segmentCount']} segments, {quality['wordCount']} words, "
        f"{transcript_source}, {processing_seconds:.1f}s)"
    )
    return record


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
    command.add_argument(
        "--no-asr-fallback",
        action="store_true",
        help="Fail instead of using local ASR when caption retrieval fails.",
    )
    command.add_argument("--refresh", action="store_true")
    command.add_argument("--topic", action="append", default=[])
    command.add_argument("--min-words", type=int, default=20)
    command.add_argument("--cookies-from-browser")
    command.add_argument("--yt-dlp", default=os.environ.get("YT_DLP_BINARY"))
    command.add_argument("--whisper-cpp", default=os.environ.get("WHISPER_CPP_BINARY"))
    command.add_argument(
        "--whisper-cpp-model", default=os.environ.get("WHISPER_CPP_MODEL")
    )
    return command


if __name__ == "__main__":
    try:
        ingest(parser().parse_args())
    except (
        RuntimeError,
        subprocess.CalledProcessError,
        subprocess.TimeoutExpired,
        KeyError,
        json.JSONDecodeError,
    ) as error:
        print(f"error: {error}", file=sys.stderr)
        raise SystemExit(1)
