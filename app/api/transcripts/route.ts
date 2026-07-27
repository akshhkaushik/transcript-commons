import { getTranscripts, transcriptWordCount } from "../../transcript-data";
import {
  CANONICAL_SITE_ORIGIN,
  canonicalHeaders,
} from "../../site-url";

export async function GET(request: Request) {
  const origin = CANONICAL_SITE_ORIGIN;
  const transcripts = getTranscripts();
  return Response.json({
    schemaVersion: 1,
    schemaUrl: `${origin}/transcript-schema.json`,
    name: "Transcript Commons",
    licenseNote:
      "Metadata and transcript provenance are provided per record. Source video rights remain with their respective owners.",
    count: transcripts.length,
    transcripts: transcripts.map((video) => ({
      videoId: video.videoId,
      title: video.title,
      channel: video.channel,
      sourceUrl: video.sourceUrl,
      transcriptUrl: `${origin}/videos/${video.videoId}`,
      plainTextUrl: `${origin}/videos/${video.videoId}/transcript.txt`,
      jsonUrl: `${origin}/videos/${video.videoId}/transcript.json`,
      jsonObjectUrl: `${origin}/data/transcripts/${video.videoId}.json`,
      textObjectUrl: `${origin}/data/transcripts/${video.videoId}.txt`,
      topics: video.topics,
      language: video.language,
      transcriptSource: video.transcriptSource,
      reviewStatus: video.reviewStatus ?? "unreviewed",
      reviewedAt: video.reviewedAt ?? null,
      reviewedBy: video.reviewedBy ?? null,
      durationSeconds: video.durationSeconds,
      wordCount: transcriptWordCount(video),
      publishedAt: video.publishedAt,
      ingestedAt: video.ingestedAt,
    })),
  }, {
    headers: {
      "cache-control": "public, max-age=300, s-maxage=3600",
      ...canonicalHeaders("/api/transcripts", request.url),
    },
  });
}
