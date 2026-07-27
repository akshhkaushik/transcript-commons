# Transcript Commons

A free, public, agent-readable library of timestamped YouTube transcripts.

The ingestion pipeline always tries existing captions first. If no English
captions are available, it downloads audio and transcribes locally with
MLX Whisper or whisper.cpp. The website publishes the result as server-rendered
HTML, compact plain text, JSON, and structured metadata.

## What the site exposes

- `/videos/:videoId` — canonical, readable transcript page
- `/videos/:videoId/transcript.txt` — compact context for research agents
- `/videos/:videoId/transcript.json` — complete structured record
- `/api/transcripts` — machine-readable library index
- `/llms.txt` — agent discovery and citation guidance
- `/sitemap.xml` and `/robots.txt` — crawler discovery

## Local setup

Requirements:

- Node.js 22+
- `yt-dlp`
- `ffmpeg`
- Apple Silicon: `mlx-whisper`
- Optional alternative: `whisper.cpp`

Install the site packages:

```bash
npm install
```

For the recommended Apple Silicon transcription path:

```bash
python3 -m pip install mlx-whisper
```

## Add one video

```bash
python3 scripts/ingest.py "https://www.youtube.com/watch?v=VIDEO_ID"
```

This tries creator captions and auto-captions before downloading audio. To
benchmark or intentionally force local ASR:

```bash
python3 scripts/ingest.py "https://www.youtube.com/watch?v=VIDEO_ID" --force-local
```

Use whisper.cpp instead:

```bash
python3 scripts/ingest.py "https://www.youtube.com/watch?v=VIDEO_ID" \
  --engine whisper-cpp \
  --whisper-cpp /path/to/whisper-cli \
  --whisper-cpp-model /path/to/ggml-small.en.bin
```

The generated record is stored in `content/transcripts.json`, so it is reviewed
and versioned with the site.

## Add a batch

Create a text file with one URL per line:

```bash
python3 scripts/ingest_batch.py healthcare-urls.txt
```

The runner stays sequential by default and waits one second between videos. Any
failures are written to `failed-urls.txt` for a later retry.

## Run the library

```bash
npm run dev
```

Then open `http://localhost:3000`.

## Publish safely

Before publishing a transcript, verify:

- the title, channel, source URL, and language;
- the transcript provenance (`creator-captions`, `auto-captions`, or
  `local-asr`);
- medical names, dosages, and numerical claims;
- the channel's rights and takedown requirements.

The page should be treated as a research aid, not medical advice. Source video
rights remain with the respective owner.
