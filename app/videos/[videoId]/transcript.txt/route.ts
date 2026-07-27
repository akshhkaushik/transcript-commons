import { getTranscript, transcriptWordCount } from "../../../transcript-data";
import { timestamp } from "../../../transcript-utils";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ videoId: string }> },
) {
  const { videoId } = await params;
  const video = getTranscript(videoId);
  if (!video) return new Response("Transcript not found.", { status: 404 });

  const body = `${video.title}
Channel: ${video.channel}
Source: ${video.sourceUrl}
Canonical transcript: ${new URL(request.url).origin}/videos/${video.videoId}
Published: ${video.publishedAt}
Language: ${video.language}
Topics: ${video.topics.join(", ")}
Transcript source: ${video.transcriptSource}
Review status: ${video.reviewStatus ?? "unreviewed"}
Words: ${transcriptWordCount(video)}

${video.segments.map((segment) => `[${timestamp(segment.start)}] ${segment.text}`).join("\n\n")}
`;

  return new Response(body, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=300, s-maxage=86400",
      "x-robots-tag": "index, follow",
    },
  });
}
