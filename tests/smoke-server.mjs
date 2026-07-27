import assert from "node:assert/strict";

const origin = (process.argv[2] ?? "http://127.0.0.1:3000").replace(/\/$/, "");
const videoId = process.argv[3] ?? "sI-1ON2jgr8";

const expectations = [
  ["/?q=diabetes", /American Medical Association/i],
  [`/videos/${videoId}`, /FULL TRANSCRIPT/],
  [`/videos/${videoId}`, /application\/ld\+json/],
  [`/videos/${videoId}/transcript.txt`, /Transcript source:/],
  [`/videos/${videoId}/transcript.json`, /contentSha256/],
  ["/api/search?q=hemoglobin", /startSeconds/],
  ["/api/search?q=hemoglobin+diabetes", /"algorithm":"BM25"/],
  ["/api/transcripts", /plainTextUrl/],
  ["/api/health", /"ok":true/],
  ["/status", /Every queued video is published/i],
  ["/policies", /Rights, corrections, and takedowns/i],
  ["/data/status.json", /"pendingCount":0/],
  ["/data/library.json", /"jsonObjectUrl"/],
  ["/data/search-index.json", /"algorithm":"BM25"/],
  [`/data/transcripts/${videoId}.json`, /contentSha256/],
  [`/data/transcripts/${videoId}.txt`, /Canonical transcript:/],
  ["/robots.txt", /OAI-SearchBot/],
  ["/robots.txt", /Claude-SearchBot/],
  ["/sitemap.xml", new RegExp(`/videos/${videoId}`)],
  ["/llms.txt", /Citation guidance/],
  ["/transcript-schema.json", /creator-captions/],
];

for (const [path, pattern] of expectations) {
  const response = await fetch(`${origin}${path}`);
  assert.equal(response.status, 200, `${path} returned ${response.status}`);
  const body = await response.text();
  assert.match(body, pattern, `${path} did not match ${pattern}`);
}

const missing = await fetch(`${origin}/videos/not-a-video`);
assert.equal(missing.status, 404);

console.log(`Verified ${expectations.length} public surfaces at ${origin}.`);
