import { getTranscripts } from "../../transcript-data";

export async function GET() {
  const transcripts = getTranscripts();
  return Response.json({
    name: "Transcript Commons",
    licenseNote:
      "Metadata and transcript provenance are provided per record. Source video rights remain with their respective owners.",
    count: transcripts.length,
    transcripts: transcripts.map((video) => ({
      videoId: video.videoId,
      title: video.title,
      channel: video.channel,
      sourceUrl: video.sourceUrl,
      transcriptUrl: `/videos/${video.videoId}`,
      plainTextUrl: `/videos/${video.videoId}/transcript.txt`,
      topics: video.topics,
      language: video.language,
      transcriptSource: video.transcriptSource,
      durationSeconds: video.durationSeconds,
    })),
  });
}
