# Transcript Commons

A free, public, agent-readable library of timestamped YouTube transcripts.
The project turns audiovisual material into an inspectable knowledge layer that
humans can read and web-searching agents can discover, quote, and cite.

The first collection is healthcare-focused. Nothing is gated behind an account,
subscription, API key, or paid transcription service.

## What is implemented

- YouTube search, playlist, and channel discovery with deduplicated URL queues.
- Creator captions first, automatic captions second, local ASR only when needed.
- Apple Silicon transcription with MLX Whisper and a whisper.cpp alternative.
- Rolling-caption deduplication and readable timestamped transcript blocks.
- Resumable sequential batches with pacing, retries, state, and interruption recovery.
- Per-record provenance, content hashes, review status, word counts, and quality warnings.
- A human review queue that records reviewer, review time, notes, and a new content hash.
- Server-rendered public transcript pages with source video, timestamps, topics, and citation guidance.
- Plain-text and JSON versions of every record, including cacheable sharded data objects.
- Generated BM25 full-text search used by both the website and machine-readable search endpoint.
- A public library/queue/review dashboard and a no-cache health endpoint.
- Desktop/webhook batch-failure alerts and scheduled GitHub production monitoring.
- A public corrections, private takedown, source-rights, privacy, and medical-accuracy policy.
- `robots.txt`, `sitemap.xml`, `llms.txt`, canonical URLs, alternate formats,
  and `VideoObject` plus `Article` structured data.
- Explicit crawler access for OAI-SearchBot, ChatGPT-User, Claude Search,
  Perplexity, and ordinary search engines.
- IndexNow submission for Bing and other participating search engines.

## Public surfaces

- `/videos/:videoId` - canonical transcript page
- `/videos/:videoId/transcript.txt` - compact timestamped context
- `/videos/:videoId/transcript.json` - complete structured record
- `/api/transcripts` - library index with absolute URLs
- `/api/search?q=diabetes` - ranked BM25 transcript and metadata search
- `/api/health` - production health signal
- `/data/library.json` - static, cacheable library index
- `/data/search-index.json` - generated full-text index
- `/data/status.json` - queue, provenance, and review counts
- `/data/transcripts/:videoId.{json,txt}` - sharded transcript objects
- `/status` - public ingestion and editorial dashboard
- `/policies` - corrections, rights, takedown, privacy, and accuracy policy
- `/transcript-schema.json` - public record schema
- `/llms.txt` - agent discovery and citation guidance
- `/sitemap.xml` and `/robots.txt` - crawler discovery

## Set up an Apple Silicon Mac

The helper installs `yt-dlp`, `ffmpeg`, and MLX Whisper:

```bash
chmod +x scripts/setup_mac.sh
./scripts/setup_mac.sh
```

Or install the pieces manually:

```bash
brew install yt-dlp ffmpeg
python3 -m venv .venv
.venv/bin/python -m pip install mlx-whisper
npm install
```

`yt-dlp` uses YouTube's public web behavior rather than a stable official
caption API. YouTube can change or rate-limit that behavior. The batch runner is
sequential by default, records failures, and can be resumed.

## Discover healthcare videos

Search YouTube and create a queue:

```bash
.venv/bin/python scripts/discover.py \
  --query "Mayo Clinic diabetes" \
  --limit 25 \
  --output queues/mayo-diabetes.txt
```

Expand a playlist or channel:

```bash
.venv/bin/python scripts/discover.py \
  --url "https://www.youtube.com/playlist?list=PLAYLIST_ID" \
  --limit 100 \
  --output queues/healthcare-playlist.txt
```

Discovery skips videos already present in `content/transcripts.json`.

## Ingest one video

```bash
.venv/bin/python scripts/ingest.py \
  "https://www.youtube.com/watch?v=VIDEO_ID"
```

The pipeline:

1. Reads video metadata and caption availability.
2. Selects English creator captions when available.
3. Otherwise selects English automatic captions.
4. If neither can be retrieved, downloads audio and runs MLX Whisper locally.
5. Normalizes, validates, hashes, and publishes the transcript record.

Force a local ASR benchmark:

```bash
.venv/bin/python scripts/ingest.py \
  "https://www.youtube.com/watch?v=VIDEO_ID" \
  --force-local
```

Use whisper.cpp:

```bash
.venv/bin/python scripts/ingest.py \
  "https://www.youtube.com/watch?v=VIDEO_ID" \
  --engine whisper-cpp \
  --whisper-cpp /path/to/whisper-cli \
  --whisper-cpp-model /path/to/ggml-small.en.bin
```

## Run a resumable weekend batch

```bash
caffeinate -i .venv/bin/python scripts/ingest_batch.py \
  queues/healthcare-starter.txt \
  --delay 2 \
  --retries 3 \
  --notify \
  --summary-file var/healthcare-summary.json
```

Progress is saved after every attempt in `var/ingest-state.json`. Re-running the
same command skips completed and already-published videos. A network failure,
caption failure, or interruption does not erase the queue.

Set `INGEST_ALERT_WEBHOOK` to a Slack-compatible webhook (or pass
`--alert-webhook`) to receive failed/interrupted batch summaries. `--notify`
also produces a macOS desktop notification.

For a long unattended run:

```bash
mkdir -p var
nohup caffeinate -i .venv/bin/python scripts/ingest_batch.py \
  queues/healthcare-starter.txt \
  --delay 2 \
  --retries 3 \
  > var/healthcare-batch.log 2>&1 &
```

## Review and validate

Healthcare transcripts must be treated as research aids, not medical advice.
Before marking an automated transcript reviewed, check:

- speaker and organization names;
- medication names, dosages, lab values, and numerical claims;
- source URL, language, title, and channel;
- timestamps around any claim likely to be cited.

Export the current review queue:

```bash
.venv/bin/python scripts/review_queue.py \
  --format markdown \
  --output var/review-queue.md
```

After checking a record against the source, record the review:

```bash
.venv/bin/python scripts/review_queue.py \
  --mark-reviewed VIDEO_ID \
  --reviewer "Reviewer name" \
  --notes "Checked against the linked source."
```

Generate the sharded objects, status snapshot, and BM25 index:

```bash
npm run generate:data
```

Run the complete local verification:

```bash
npm test
npm run lint
npm run build:vercel
npm run build
```

## Local website

```bash
npm run dev:vercel
```

Open `http://localhost:3000`.

The alternate Sites runtime uses:

```bash
npm run dev
```

## Publishing model

Transcription never runs in a hosted function. It runs on the operator's Mac,
then writes reviewed, versionable records into `content/transcripts.json`.
Pushing those records publishes the same public HTML, text, JSON, search index,
and sitemap on the configured deployments.

`https://transcript-commons.vercel.app` is the sole canonical origin. Any mirror
uses canonical links and `noindex, follow`, preventing duplicate search results.
The scheduled GitHub monitor verifies the public HTML, APIs, crawler files,
status, policy, and static data twice per hour. A failed run opens or updates a
public issue and a recovery closes it.

Search engines and AI products decide when to crawl and rank a page, so
publication cannot guarantee immediate discovery. The project supplies the
technical prerequisites: successful public responses, server-rendered text,
stable canonical URLs, crawler permissions, sitemaps, structured metadata, and
direct source attribution.

## Rights and corrections

Source video rights remain with the original publisher. Each record links to
the YouTube source and declares how the transcript was produced. The live
`/policies` page provides a public correction form and a private takedown
contact. Medical transcripts are research aids, not medical advice.

## Search-engine submission

The sitemap is referenced by `robots.txt`. Every publish also sends canonical
page URLs through IndexNow; run the same submission manually with:

```bash
python3 scripts/submit_indexnow.py --submit
```

Google Search Console and Bing Webmaster Tools still require site-owner account
authorization for their dashboards. The canonical sitemap to submit is:

```text
https://transcript-commons.vercel.app/sitemap.xml
```

See [docs/OPERATIONS.md](docs/OPERATIONS.md) for the release, review, incident,
and search-engine procedures.
