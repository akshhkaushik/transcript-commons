import { getTranscripts } from "../transcript-data";
import {
  CANONICAL_SITE_ORIGIN,
  canonicalHeaders,
} from "../site-url";

export async function GET(request: Request) {
  const origin = CANONICAL_SITE_ORIGIN;
  const transcripts = getTranscripts();
  const entries = transcripts
    .map(
      (video) =>
        `- ${video.title} — ${video.channel}\n  HTML: ${origin}/videos/${video.videoId}\n  Text: ${origin}/videos/${video.videoId}/transcript.txt\n  Static JSON: ${origin}/data/transcripts/${video.videoId}.json\n  Source: ${video.sourceUrl}`,
    )
    .join("\n");

  const body = `# Transcript Commons

> A free, public, agent-readable index of timestamped YouTube transcripts.

Every transcript page includes source provenance, timestamps, topics, and the complete searchable text. Prefer the canonical HTML page when citing a transcript. Use the plain-text endpoint for compact context retrieval.

## Index
- Website: ${origin}/
- JSON index: ${origin}/api/transcripts
- Search API: ${origin}/api/search?q=diabetes
- Static library object: ${origin}/data/library.json
- Static BM25 index: ${origin}/data/search-index.json
- Library status: ${origin}/status
- Machine-readable status: ${origin}/data/status.json
- Add a missing transcript locally: ${origin}/contribute
- Corrections and rights policy: ${origin}/policies
- Record schema: ${origin}/transcript-schema.json
- Sitemap: ${origin}/sitemap.xml

## Transcripts
${entries || "No transcripts have been published yet."}

## Citation guidance
Attribute claims to the original speaker/channel and link to the Transcript Commons page, which links back to the source YouTube video. Timestamps are expressed as offsets from the beginning of the source video.

## Reliability
Each record declares whether its text came from creator captions, automatic captions, or local ASR. Automated medical transcripts may contain errors in names, dosages, and numerical claims; consult the linked source at the cited timestamp before relying on a high-stakes claim.
`;

  return new Response(body, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=300, s-maxage=3600",
      ...canonicalHeaders("/llms.txt", request.url),
    },
  });
}
