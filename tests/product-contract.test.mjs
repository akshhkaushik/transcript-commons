import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function source(path) {
  return readFile(new URL(path, root), "utf8");
}

test("wires agent search to the canonical Registry", async () => {
  const [robots, sitemap, llms, api, search, schema, status, health, contribute] = await Promise.all([
    source("app/robots.ts"),
    source("app/sitemap.ts"),
    source("app/llms.txt/route.ts"),
    source("app/api/transcripts/route.ts"),
    source("app/api/search/route.ts"),
    source("public/transcript-schema.json"),
    source("app/status/page.tsx"),
    source("app/api/health/route.ts"),
    source("app/contribute/page.tsx"),
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
  assert.match(sitemap, /\/contribute/);
  assert.match(llms, /transcript-registry\.vercel\.app/);
  assert.match(llms, /search\.txt/);
  assert.match(llms, /automatically creates a deduplicated topic job/i);
  assert.match(api, /plainTextUrl/);
  assert.match(api, /jsonObjectUrl/);
  assert.match(search, /transcript-registry\.vercel\.app/);
  assert.match(search, /\/search\.json/);
  assert.match(search, /new URL\(result\.transcript, REGISTRY_ORIGIN\)/);
  assert.match(schema, /creator-captions/);
  assert.match(status, /Every queued video is published/);
  assert.match(health, /publishedCount/);
  assert.match(contribute, /Your computer does the work/);
  assert.match(contribute, /content\/transcripts\.json/);
  assert.match(contribute, /whisper-cpp/);
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
  assert.match(ingest, /PERMISSIONED_CHANNEL_IDS/);
  assert.match(ingest, /--audio-fallback/);
  assert.match(pipeline, /creator-captions/);
  assert.match(pipeline, /transcript_hash/);
  assert.match(ingest, /contentSha256/);
  assert.match(batch, /retrying/);
  assert.match(discover, /ytsearch/);
});

test("ships the Registry worker and broad-topic corpus tools", async () => {
  const [worker, client, topics, datasets, architecture] = await Promise.all([
    source("scripts/registry_worker.py"),
    source("scripts/registry_api.py"),
    source("topics/broad-topics.txt"),
    source("datasets/youtube-datasets.json"),
    source("docs/ARCHITECTURE.md"),
  ]);
  assert.match(worker, /api\/worker\/topics\/claim/);
  assert.match(worker, /api\/worker\/claim/);
  assert.match(client, /api\/admin\/import|registry_record/);
  assert.match(topics, /linear algebra/i);
  assert.match(topics, /public health/i);
  assert.match(datasets, /YouTube-Commons/);
  assert.match(datasets, /recommended-bulk-import/);
  assert.match(architecture, /Transcript Registry is the public system of record/);
});

test("publishes operations, correction, and monitoring workflows", async () => {
  const [policies, review, batch, monitor, generatedData] = await Promise.all([
    source("app/policies/page.tsx"),
    source("scripts/review_queue.py"),
    source("scripts/ingest_batch.py"),
    source(".github/workflows/production-monitor.yml"),
    source("scripts/build_public_data.py"),
  ]);
  assert.match(policies, /Ask for removal/);
  assert.match(policies, /Check important information/);
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
