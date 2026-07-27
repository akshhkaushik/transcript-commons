import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function source(path) {
  return readFile(new URL(path, root), "utf8");
}

test("publishes the agent discovery surfaces", async () => {
  const [robots, sitemap, llms, api] = await Promise.all([
    source("app/robots.ts"),
    source("app/sitemap.ts"),
    source("app/llms.txt/route.ts"),
    source("app/api/transcripts/route.ts"),
  ]);

  assert.match(robots, /GPTBot/);
  assert.match(robots, /ClaudeBot/);
  assert.match(robots, /PerplexityBot/);
  assert.match(sitemap, /getTranscripts/);
  assert.match(llms, /Plain-text endpoint/i);
  assert.match(api, /plainTextUrl/);
});

test("keeps complete transcript text server-rendered", async () => {
  const page = await source("app/videos/[videoId]/page.tsx");
  assert.match(page, /application\/ld\+json/);
  assert.match(page, /video\.segments\.map/);
  assert.match(page, /WATCH SOURCE/);
  assert.doesNotMatch(page, /"use client"/);
});

test("uses captions first and local ASR only as fallback", async () => {
  const ingest = await source("scripts/ingest.py");
  assert.match(ingest, /--write-subs/);
  assert.match(ingest, /--write-auto-subs/);
  assert.match(ingest, /mlx_whisper\.transcribe/);
  assert.match(ingest, /whisper-cli/);
  assert.match(ingest, /force_local/);
});
