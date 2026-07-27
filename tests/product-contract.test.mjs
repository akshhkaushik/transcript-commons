import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function source(path) {
  return readFile(new URL(path, root), "utf8");
}

test("publishes the agent discovery surfaces", async () => {
  const [robots, sitemap, llms, api, search, schema, status, health] = await Promise.all([
    source("app/robots.ts"),
    source("app/sitemap.ts"),
    source("app/llms.txt/route.ts"),
    source("app/api/transcripts/route.ts"),
    source("app/api/search/route.ts"),
    source("public/transcript-schema.json"),
    source("app/status/page.tsx"),
    source("app/api/health/route.ts"),
  ]);

  assert.match(robots, /OAI-SearchBot/);
  assert.match(robots, /ChatGPT-User/);
  assert.match(robots, /GPTBot/);
  assert.match(robots, /ClaudeBot/);
  assert.match(robots, /Claude-SearchBot/);
  assert.match(robots, /PerplexityBot/);
  assert.match(sitemap, /getTranscripts/);
  assert.match(sitemap, /\/policies/);
  assert.match(sitemap, /\/status/);
  assert.match(llms, /Plain-text endpoint/i);
  assert.match(llms, /Search API/i);
  assert.match(llms, /Static BM25 index/i);
  assert.match(api, /plainTextUrl/);
  assert.match(api, /jsonObjectUrl/);
  assert.match(search, /searchTranscripts/);
  assert.match(search, /BM25/);
  assert.match(schema, /creator-captions/);
  assert.match(status, /Every queued video is published/);
  assert.match(health, /publishedCount/);
});

test("keeps complete transcript text server-rendered", async () => {
  const page = await source("app/videos/[videoId]/page.tsx");
  assert.match(page, /application\/ld\+json/);
  assert.match(page, /articleBody/);
  assert.match(page, /VideoObject/);
  assert.match(page, /video\.segments\.map/);
  assert.match(page, /WATCH SOURCE/);
  assert.doesNotMatch(page, /"use client"/);
});

test("uses captions first and local ASR only as fallback", async () => {
  const [ingest, pipeline, batch, discover] = await Promise.all([
    source("scripts/ingest.py"),
    source("scripts/transcript_pipeline.py"),
    source("scripts/ingest_batch.py"),
    source("scripts/discover.py"),
  ]);
  assert.match(ingest, /--write-subs/);
  assert.match(ingest, /--write-auto-subs/);
  assert.match(ingest, /mlx_whisper\.transcribe/);
  assert.match(ingest, /whisper-cli/);
  assert.match(ingest, /force_local/);
  assert.match(pipeline, /creator-captions/);
  assert.match(pipeline, /transcript_hash/);
  assert.match(ingest, /contentSha256/);
  assert.match(batch, /retrying/);
  assert.match(discover, /ytsearch/);
});

test("publishes operations, correction, and monitoring workflows", async () => {
  const [policies, review, batch, monitor, generatedData] = await Promise.all([
    source("app/policies/page.tsx"),
    source("scripts/review_queue.py"),
    source("scripts/ingest_batch.py"),
    source(".github/workflows/production-monitor.yml"),
    source("scripts/build_public_data.py"),
  ]);
  assert.match(policies, /Takedowns and publisher requests/);
  assert.match(policies, /Medical accuracy/);
  assert.match(review, /mark_reviewed/);
  assert.match(review, /contentSha256/);
  assert.match(batch, /INGEST_ALERT_WEBHOOK/);
  assert.match(monitor, /schedule:/);
  assert.match(monitor, /issues: write/);
  assert.match(generatedData, /build_search_index/);
  assert.match(generatedData, /TRANSCRIPT_OBJECTS_DIR/);
});

test("uses Vercel as the only canonical origin", async () => {
  const [siteUrl, layout] = await Promise.all([
    source("app/site-url.ts"),
    source("app/layout.tsx"),
  ]);
  assert.match(siteUrl, /transcript-commons\.vercel\.app/);
  assert.match(siteUrl, /noindex, follow/);
  assert.match(layout, /isCanonicalHost/);
  assert.match(layout, /SITE_MIRROR_NOINDEX/);
  assert.match(layout, /canonical: CANONICAL_SITE_ORIGIN/);
});
