# Transcript Commons completion audit

Last audited: 2026-07-28 (Asia/Kolkata)

This audit tests the requested end state against source, generated artifacts,
public runtime responses, repository state, and automation runs. A green test
alone is not used as proof for a requirement it does not exercise.

## Requirement audit

| Requirement | Authoritative evidence | Result |
| --- | --- | --- |
| Find and queue YouTube videos | `scripts/discover.py`; nine unique IDs across `queues/*.txt`; generated status reports `queuedCount: 9` | Complete |
| Ingest the seven pending Mayo Clinic diabetes videos | `content/transcripts.json` contains all queued Mayo IDs; generated status reports `publishedCount: 9`, `pendingCount: 0` | Complete |
| Prefer existing captions | Published provenance contains four creator-caption and four automatic-caption records; caption selection unit tests pass | Complete |
| Use local open-source ASR when captions are absent | `QsSZNetJIuA` records `local-asr`, MLX, and `mlx-community/whisper-small-mlx` | Complete |
| Improve ASR quality | The earlier Tiny demo was regenerated with Whisper Small; proper nouns were corrected against Mayo Clinic's published script; the record has a fresh content hash | Complete |
| Provide a medical transcript review workflow | `scripts/review_queue.py`, public review states/warnings, reviewer/time/notes fields, correction issue form, and status counts are live | Complete |
| Publish one public page per video | Nine server-rendered `/videos/:videoId` pages return 200 and expose title, channel, source, topics, timestamps, full text, provenance, and review state | Complete |
| Provide agent-readable alternate formats | Dynamic `.txt` and `.json` routes plus static sharded `.txt`/`.json` objects are live for every record | Complete |
| Make the library searchable | Generated BM25 index has 169 documents and 1,314 terms; live `insulin resistance` search ranks the dedicated Mayo video first | Complete |
| Support a much larger library | Transcript objects are sharded per video; the generated library, status, and BM25 posting index are deterministic and independently cacheable | Complete |
| Make pages discoverable to research agents | Server-rendered text, structured `VideoObject`/`Article` data, `robots.txt`, `sitemap.xml`, `llms.txt`, JSON index, and search API are live | Complete |
| Keep access free and ungated | Vercel and Sites deployments are public; reading, searching, and data retrieval require no account, subscription, or API key | Complete |
| Use one canonical search origin | Vercel HTML/API return `index, follow`; Sites HTML/API return `noindex, follow`; both point canonically to `https://transcript-commons.vercel.app` | Complete |
| Publish corrections, rights, takedown, privacy, contact, and medical-accuracy policy | `/policies` is live; correction and rights issue forms and repository labels exist | Complete |
| Add batch failure alerts | `scripts/ingest_batch.py` writes machine-readable summaries and supports macOS and webhook alerts | Complete |
| Add public batch/status dashboard | `/status`, `/api/health`, and `/data/status.json` are live and agree on published, pending, source, and review counts | Complete |
| Add uptime monitoring | Scheduled GitHub workflow tests 21 production surfaces twice per hour; manual run `30298361743` completed successfully on Node 24 actions | Complete |
| Publish source publicly | `akshhkaushik/transcript-commons` is public with `main` as its default branch | Complete |
| Deploy to the user's Vercel account | The linked `aksh08022006` project is ready at `https://transcript-commons.vercel.app` | Complete |
| Deploy the Sites mirror | Sites version 4 is live at `https://transcript-commons.rurradvisors.chatgpt.site` with environment revision 1 | Complete |
| Notify Bing and participating engines | IndexNow accepted all 14 canonical URLs with HTTP 200; the automatic GitHub workflow also completed successfully | Complete |
| Submit sitemap in Google Search Console | Search Console is currently signed out; URL-prefix verification and dashboard submission require the site owner's Google authorization | **Pending user authorization** |
| Submit sitemap in Bing Webmaster Tools | Bing Webmaster Tools is currently signed out; dashboard submission/import requires the site owner's Microsoft authorization | **Pending user authorization** |

## Verification gates

The following gates passed during the audit:

```text
npm test
npm run lint
node tests/smoke-server.mjs https://transcript-commons.vercel.app
node tests/smoke-server.mjs https://transcript-commons.rurradvisors.chatgpt.site
```

The two smoke runs each verified 21 public surfaces, including HTML transcript
pages, text and JSON formats, search, library index, health, status, policies,
sharded objects, crawler rules, sitemap, `llms.txt`, schema, and 404 behavior.

## Current library facts

- 9 published videos; 9 queued; 0 pending
- 5,646 searchable words across 2,470 seconds of source video
- Sources: 4 creator captions, 4 automatic captions, 1 local ASR
- Review states: 4 source-caption records, 4 automated-unreviewed records, 1
  source-checked editorial review
- 18 sharded transcript files: one JSON and one plain-text object per video

Automated medical records deliberately remain labelled
`automated-unreviewed`; passing syntax or search tests is not treated as medical
review.
