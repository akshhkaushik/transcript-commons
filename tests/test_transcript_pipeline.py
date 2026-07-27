from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from scripts.ingest_batch import load_urls
from scripts.transcript_pipeline import (
    choose_caption_track,
    normalize_segments,
    parse_json3,
    validate_record,
    youtube_video_id,
)


class TranscriptPipelineTests(unittest.TestCase):
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
            "segments": [{"start": 0, "duration": 3, "text": "Hello world."}],
        }
        self.assertEqual(validate_record(record), [])

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


if __name__ == "__main__":
    unittest.main()
