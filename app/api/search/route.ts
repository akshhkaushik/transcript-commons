import { getTranscripts } from "../../transcript-data";
import { excerpt, searchTranscripts } from "../../transcript-utils";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = (url.searchParams.get("q") ?? "").trim();
  const limit = Math.min(
    100,
    Math.max(1, Number.parseInt(url.searchParams.get("limit") ?? "25", 10) || 25),
  );
  const origin = url.origin;
  const hits = searchTranscripts(getTranscripts(), query).slice(0, limit);

  return Response.json(
    {
      query,
      count: hits.length,
      results: hits.map(({ transcript, match }) => ({
        videoId: transcript.videoId,
        title: transcript.title,
        channel: transcript.channel,
        topics: transcript.topics,
        transcriptUrl: `${origin}/videos/${transcript.videoId}`,
        plainTextUrl: `${origin}/videos/${transcript.videoId}/transcript.txt`,
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
        "x-robots-tag": "index, follow",
      },
    },
  );
}
