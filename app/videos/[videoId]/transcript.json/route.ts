import { getTranscript } from "../../../transcript-data";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ videoId: string }> },
) {
  const { videoId } = await params;
  const video = getTranscript(videoId);
  if (!video) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json(video);
}
