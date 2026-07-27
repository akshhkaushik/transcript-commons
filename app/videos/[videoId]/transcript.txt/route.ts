import { getTranscript } from "../../../transcript-data";

function timestamp(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${minutes}:${String(secs).padStart(2, "0")}`;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ videoId: string }> },
) {
  const { videoId } = await params;
  const video = getTranscript(videoId);
  if (!video) return new Response("Transcript not found.", { status: 404 });

  const body = `${video.title}
Channel: ${video.channel}
Source: ${video.sourceUrl}
Transcript source: ${video.transcriptSource}

${video.segments.map((segment) => `[${timestamp(segment.start)}] ${segment.text}`).join("\n\n")}
`;

  return new Response(body, {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}
