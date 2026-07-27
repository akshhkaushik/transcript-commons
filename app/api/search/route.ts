import { getTranscripts } from "../../transcript-data";
import { excerpt, searchTranscripts } from "../../transcript-utils";
import {
  CANONICAL_SITE_ORIGIN,
  canonicalHeaders,
} from "../../site-url";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = (url.searchParams.get("q") ?? "").trim();
  const limit = Math.min(
    100,
    Math.max(1, Number.parseInt(url.searchParams.get("limit") ?? "25", 10) || 25),
  );
  const origin = CANONICAL_SITE_ORIGIN;
  const hits = searchTranscripts(getTranscripts(), query).slice(0, limit);

  return Response.json(
    {
      query,
      count: hits.length,
      algorithm: query ? "BM25" : "latest",
      results: hits.map(({ transcript, match, score, matchedTerms }) => ({
        videoId: transcript.videoId,
        title: transcript.title,
        channel: transcript.channel,
        topics: transcript.topics,
        score: score ?? null,
        matchedTerms: matchedTerms ?? [],
        transcriptUrl: `${origin}/videos/${transcript.videoId}`,
        plainTextUrl: `${origin}/videos/${transcript.videoId}/transcript.txt`,
        jsonObjectUrl: `${origin}/data/transcripts/${transcript.videoId}.json`,
        textObjectUrl: `${origin}/data/transcripts/${transcript.videoId}.txt`,
        sourceUrl: transcript.sourceUrl,
        match: match
          ? {
              startSeconds: match.start,
              text: excerpt(match.text, query, 320),
            }
          : null,
      })),
    },
    {
      headers: {
        "cache-control": "public, max-age=60, s-maxage=600",
        ...canonicalHeaders(`/api/search?q=${encodeURIComponent(query)}`, request.url),
      },
    },
  );
}
