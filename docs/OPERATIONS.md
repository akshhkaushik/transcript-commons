# Operations

## Recommended batch policy

- Start with trusted healthcare institutions and known expert channels.
- Run one request at a time with at least a one-to-two second delay.
- Prefer creator captions; do not spend local compute when usable captions exist.
- Retry transient failures with exponential backoff.
- Keep `var/ingest-state.json` and the batch log until the run is reviewed.
- Commit transcript records in small, inspectable batches.

## Review states

- `source-captions`: creator-provided text; still verify high-stakes details.
- `automated-unreviewed`: automatic captions or local ASR; visible warning required.
- `reviewed`: a human checked identity, medical names, numerical claims, and timestamps.

## Failure recovery

Re-run the same `ingest_batch.py` command. Successful and published entries are
skipped. Failed entries are retried up to the configured limit and retain their
last error in the state file.

If YouTube requests authentication, use `--cookies-from-browser chrome` (or the
browser installed on the Mac) only for videos the operator is authorized to
access. Never publish transcripts of private or access-controlled material.

## Corrections

Edit the affected record, preserve its source URL, recompute the content hash by
re-ingesting or using the pipeline helper, run content validation, then deploy.
For a takedown, remove the record, rebuild, and verify that its canonical URL
returns 404 and is absent from the sitemap and agent index.
