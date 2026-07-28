from __future__ import annotations

import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))

from scripts.build_public_data import (
    build_search_index,
    build_status,
    queued_items,
    tokenize,
)
from scripts.ingest_batch import load_urls, write_summary
from scripts.ingest import audio_fallback_allowed
from scripts.registry_api import registry_record
from scripts.review_queue import mark_reviewed, review_items
from scripts.submit_indexnow import canonical_urls, payload
from scripts.transcript_pipeline import (
    choose_caption_track,
    normalize_segments,
    parse_json3,
    validate_record,
    youtube_video_id,
)


class TranscriptPipelineTests(unittest.TestCase):
    def test_audio_fallback_defaults_to_permissioned_sources(self) -> None:
        self.assertEqual(
            audio_fallback_allowed(
                {"license": "Creative Commons Attribution"},
                "permissioned",
            ),
            (True, "creative-commons"),
        )
        self.assertEqual(
            audio_fallback_allowed({"license": "Standard YouTube License"}, "permissioned"),
            (False, "permission-required"),
        )

    def test_commons_record_maps_to_registry_contract(self) -> None:
        mapped = registry_record(
            {
                "videoId": "sI-1ON2jgr8",
                "title": "Example",
                "channel": "Example Channel",
                "sourceUrl": "https://www.youtube.com/watch?v=sI-1ON2jgr8",
                "transcriptSource": "auto-captions",
                "segments": [
                    {"start": 2, "duration": 3, "text": "A useful sentence."}
                ],
            }
        )
        self.assertEqual(mapped["transcriptSource"], "automatic-captions")
        self.assertEqual(mapped["segments"][0]["end"], 5)
        self.assertEqual(mapped["transcriptText"], "A useful sentence.")

    def test_youtube_video_id_variants(self) -> None:
        expected = "sI-1ON2jgr8"
        self.assertEqual(
            youtube_video_id(f"https://www.youtube.com/watch?v={expected}"), expected
        )
        self.assertEqual(youtube_video_id(f"https://youtu.be/{expected}"), expected)
        self.assertEqual(youtube_video_id(f"https://youtube.com/shorts/{expected}"), expected)

    def test_creator_captions_win_over_automatic_captions(self) -> None:
        metadata = {
            "subtitles": {"en-US": [{"ext": "json3"}]},
            "automatic_captions": {"en": [{"ext": "json3"}]},
        }
        self.assertEqual(
            choose_caption_track(metadata, "en"),
            {"language": "en-US", "source": "creator-captions"},
        )

    def test_automatic_caption_fallback(self) -> None:
        metadata = {
            "subtitles": {},
            "automatic_captions": {"en-orig": [{"ext": "json3"}]},
        }
        self.assertEqual(
            choose_caption_track(metadata, "en"),
            {"language": "en-orig", "source": "auto-captions"},
        )

    def test_rolling_caption_text_is_deduplicated(self) -> None:
        segments = normalize_segments(
            [
                {"start": 0, "duration": 2, "text": "Welcome to the clinic"},
                {
                    "start": 1.5,
                    "duration": 2,
                    "text": "Welcome to the clinic today",
                },
                {
                    "start": 3.2,
                    "duration": 2,
                    "text": "clinic today we discuss diabetes",
                },
            ],
            coalesce=False,
        )
        self.assertEqual(len(segments), 2)
        self.assertEqual(segments[0]["text"], "Welcome to the clinic today")
        self.assertEqual(segments[1]["text"], "we discuss diabetes")

    def test_json3_parser_returns_readable_blocks(self) -> None:
        payload = {
            "events": [
                {
                    "tStartMs": 0,
                    "dDurationMs": 1500,
                    "segs": [{"utf8": "Blood "}, {"utf8": "pressure"}],
                },
                {
                    "tStartMs": 1600,
                    "dDurationMs": 1500,
                    "segs": [{"utf8": "matters."}],
                },
            ]
        }
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "captions.json3"
            path.write_text(json.dumps(payload), encoding="utf-8")
            segments = parse_json3(path)
        self.assertEqual(segments[0]["text"], "Blood pressure matters.")

    def test_record_validation(self) -> None:
        record = {
            "videoId": "sI-1ON2jgr8",
            "title": "Diabetes screening",
            "channel": "Example",
            "sourceUrl": "https://www.youtube.com/watch?v=sI-1ON2jgr8",
            "durationSeconds": 30,
            "language": "en",
            "topics": ["Diabetes"],
            "transcriptSource": "creator-captions",
            "reviewStatus": "source-captions",
            "segments": [{"start": 0, "duration": 3, "text": "Hello world."}],
        }
        self.assertEqual(validate_record(record), [])

    def test_review_queue_and_mark_reviewed(self) -> None:
        record = {
            "videoId": "sI-1ON2jgr8",
            "title": "Diabetes screening",
            "channel": "Example",
            "sourceUrl": "https://www.youtube.com/watch?v=sI-1ON2jgr8",
            "durationSeconds": 30,
            "language": "en",
            "topics": ["Diabetes"],
            "transcriptSource": "auto-captions",
            "reviewStatus": "automated-unreviewed",
            "quality": {
                "segmentCount": 1,
                "wordCount": 2,
                "warnings": [
                    "Automated transcript; verify medical names, dosages, and numbers."
                ],
            },
            "segments": [{"start": 0, "duration": 3, "text": "Hello world."}],
        }
        self.assertEqual(len(review_items([record])), 1)
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "transcripts.json"
            path.write_text("[]\n", encoding="utf-8")
            updated = mark_reviewed(
                [record],
                video_id=record["videoId"],
                reviewer="Medical reviewer",
                notes="Checked against the source.",
                path=path,
            )
            self.assertEqual(updated["reviewStatus"], "reviewed")
            self.assertEqual(updated["reviewedBy"], "Medical reviewer")
            self.assertEqual(updated["quality"]["warnings"], [])
            self.assertEqual(validate_record(updated), [])

    def test_batch_summary_is_machine_readable(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "summary.json"
            payload = write_summary(
                path,
                state_file=Path(directory) / "state.json",
                total=8,
                available=7,
                failed=1,
                status="failed",
            )
            self.assertEqual(payload["available"], 7)
            self.assertEqual(json.loads(path.read_text())["failed"], 1)

    def test_batch_queue_strips_generated_inline_comments(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "queue.txt"
            path.write_text(
                "https://www.youtube.com/watch?v=sI-1ON2jgr8  # AMA diabetes\n",
                encoding="utf-8",
            )
            self.assertEqual(
                load_urls(path),
                ["https://www.youtube.com/watch?v=sI-1ON2jgr8"],
            )

    def test_generated_bm25_index_contains_metadata_and_transcript_terms(self) -> None:
        records = [
            {
                "videoId": "sI-1ON2jgr8",
                "title": "Diabetes screening",
                "channel": "Example Clinic",
                "description": "Evidence-based care",
                "topics": ["Diabetes"],
                "ingestedAt": "2026-01-01T00:00:00+00:00",
                "segments": [
                    {
                        "start": 0,
                        "duration": 3,
                        "text": "Hemoglobin A1C is discussed.",
                    }
                ],
            }
        ]
        index = build_search_index(records)
        self.assertEqual(index["algorithm"], "BM25")
        self.assertEqual(index["documentCount"], 2)
        self.assertIn("diabetes", index["postings"])
        self.assertIn("hemoglobin", index["postings"])
        self.assertNotIn("the", tokenize("the diabetes"))

    def test_status_reconciles_deduplicated_queues_with_published_records(self) -> None:
        records = [
            {
                "videoId": "sI-1ON2jgr8",
                "ingestedAt": "2026-01-01T00:00:00+00:00",
                "durationSeconds": 30,
                "transcriptSource": "creator-captions",
                "reviewStatus": "source-captions",
                "quality": {"wordCount": 2},
                "segments": [{"start": 0, "duration": 1, "text": "Hello world"}],
            }
        ]
        with tempfile.TemporaryDirectory() as directory:
            first = Path(directory) / "first.txt"
            second = Path(directory) / "second.txt"
            first.write_text(
                "https://www.youtube.com/watch?v=sI-1ON2jgr8 # Existing — Clinic\n"
                "https://youtu.be/QsSZNetJIuA # Pending — Mayo Clinic\n",
                encoding="utf-8",
            )
            second.write_text(
                "https://youtu.be/QsSZNetJIuA # Duplicate — Mayo Clinic\n",
                encoding="utf-8",
            )
            queue = queued_items([first, second])
        status = build_status(records, queue)
        self.assertEqual(status["queuedCount"], 2)
        self.assertEqual(status["pendingCount"], 1)
        self.assertEqual(status["pending"][0]["videoId"], "QsSZNetJIuA")

    def test_indexnow_payload_uses_only_canonical_vercel_urls(self) -> None:
        records = [{"videoId": "sI-1ON2jgr8"}]
        urls = canonical_urls(records, "https://transcript-commons.vercel.app/")
        self.assertIn(
            "https://transcript-commons.vercel.app/videos/sI-1ON2jgr8",
            urls,
        )
        data = payload(records, "https://transcript-commons.vercel.app")
        self.assertEqual(data["host"], "transcript-commons.vercel.app")
        self.assertTrue(data["keyLocation"].endswith(f"{data['key']}.txt"))


if __name__ == "__main__":
    unittest.main()
