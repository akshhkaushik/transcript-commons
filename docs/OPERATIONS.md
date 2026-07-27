# Transcript Commons operations

## Canonical production origin

The only indexable origin is `https://transcript-commons.vercel.app`.
`NEXT_PUBLIC_SITE_URL` may override it for a future custom domain, but a domain
migration must also update generated-data and IndexNow origins. The Sites mirror
publishes the same public content with a canonical link to Vercel and
`noindex, follow`.

## Ingestion

1. Put one YouTube URL per line in a file under `queues/`.
2. Run `scripts/ingest_batch.py` from the Mac with delay and retry settings.
3. Let creator captions win; use automatic captions second; run local ASR only
   when neither caption source can be retrieved.
4. Commit the changed `content/transcripts.json`.

The batch state and log belong under ignored `var/`. Use `--summary-file` for a
machine-readable completion record, `--notify` for a macOS notification, and
`INGEST_ALERT_WEBHOOK` for remote failure alerts.

Recommended batch policy:

- start with trusted healthcare institutions and known expert channels;
- run one request at a time with at least a one-to-two second delay;
- prefer creator captions and do not spend local compute when usable captions exist;
- retry transient failures with exponential backoff;
- retain the state file and batch log until the run is reviewed;
- commit transcript records in small, inspectable batches.

To recover from a failure, re-run the same batch command. Successful and already
published entries are skipped, while failed entries retain their last error and
retry count. If YouTube requests authentication, use
`--cookies-from-browser chrome` (or the installed browser) only for material the
operator is authorized to access. Never publish private or access-controlled
material.

## Editorial review

Automated captions and local ASR are `automated-unreviewed`. Do not change that
label merely because the text reads fluently. Check the full source, especially
speaker names, medical terms, medications, dosages, units, numbers, and any
claim likely to be cited.

`scripts/review_queue.py` lists pending records and records a completed review.
Marking a review saves reviewer identity, time, notes, and a fresh transcript
content hash. Public corrections use the repository issue form. Private rights
and takedown requests use the email on `/policies`.

## Generated public data

`npm run generate:data` deterministically creates:

- one `.json` and `.txt` object per video under `public/data/transcripts/`;
- `public/data/library.json`;
- `public/data/status.json`;
- `public/data/search-index.json`;
- build-time status and index snapshots under `content/`.

The index stores token postings for BM25 ranking. Transcript objects are
sharded so agents do not need to download a single ever-growing source file.
When the collection becomes too large for build-time JSON imports, the same
object/index format can move to object storage without changing public URLs.

## Release checklist

1. Run `npm test`.
2. Run `npm run lint`.
3. Run `npm run build:vercel`.
4. Run `npm run build`.
5. Push `main` to the public GitHub repository.
6. Confirm the connected Vercel deployment is ready.
7. Publish the exact pushed commit to the existing Sites project.
8. Run `node tests/smoke-server.mjs https://transcript-commons.vercel.app`.
9. Run `python3 scripts/submit_indexnow.py --submit`.

## Monitoring and incidents

The production-monitor GitHub workflow runs twice per hour. It checks the
homepage search, a transcript page and both alternate formats, APIs, health
endpoint, status and policy pages, generated objects, crawler files, sitemap,
and `llms.txt`.

On failure it opens or updates `[Monitor] Transcript Commons production
failure`. On recovery it comments and closes the incident. Batch ingestion
failures are separate: they remain in the resume-state file and trigger the
configured desktop/webhook alert.

## Google and Bing

The sitemap is:

`https://transcript-commons.vercel.app/sitemap.xml`

It is declared in `robots.txt`. IndexNow provides automatic notification to Bing
and other participants. Google Search Console and the Bing Webmaster Tools
dashboard require the operator to sign in and verify the URL-prefix property;
after verification, submit the sitemap path `sitemap.xml`.
