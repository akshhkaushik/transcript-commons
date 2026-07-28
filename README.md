# Transcript Commons

Transcript Commons is the local-compute and discovery companion to
[Transcript Registry](https://transcript-registry.vercel.app), the free public
database that agents search.

The Registry stores and serves transcripts. This repo finds YouTube videos,
uses captions first, runs Whisper locally when permitted, and publishes the
result to the Registry. The video or audio is never uploaded to Vercel.

## Run a worker

Install Python 3, `yt-dlp`, and either
[mlx-whisper](https://github.com/ml-explore/mlx-examples/tree/main/whisper) on
Apple silicon or [whisper.cpp](https://github.com/ggml-org/whisper.cpp).

```bash
git clone https://github.com/akshhkaushik/transcript-commons.git
cd transcript-commons
cp .env.worker.example .env.worker
```

Put the Registry worker token in `.env.worker`, then check and start it:

```bash
npm run worker:check
npm run worker:registry
```

When an agent searches an absent topic, the Registry queues it. This worker
discovers captioned videos for that topic, turns them into transcript jobs, and
publishes the finished records back to the shared database.

Local ASR defaults to Creative Commons or explicitly allow-listed channels.
Add permitted channel IDs to `PERMISSIONED_CHANNEL_IDS`, or choose another
`AUDIO_FALLBACK` policy only when you have the right to process and republish
that material.

## Backfill topics or existing local records

```bash
npm run seed:topics -- --max-topics 20
npm run publish:registry
```

The broad topic list is in `topics/broad-topics.txt`. Researched public
YouTube-related datasets and their safe uses are catalogued in
`datasets/youtube-datasets.json`. PleIAs YouTube-Commons is the preferred bulk
source because its records are Creative Commons and include attribution.

The old Next.js app remains a small compatibility/archive surface. Its search
API now forwards to the live Registry.

## Check the repo

```bash
npm install
npm test
npm run lint
npm run build:vercel
```
