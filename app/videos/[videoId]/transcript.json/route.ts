import { getTranscript } from "../../../transcript-data";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ videoId: string }> },
) {
  const { videoId } = await params;
  const video = getTranscript(videoId);
  if (!video) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json(
    {
      $schema: `${new URL(request.url).origin}/transcript-schema.json`,
      ...video,
    },
    {
      headers: {
        "cache-control": "public, max-age=300, s-maxage=86400",
        "x-robots-tag": "index, follow",
      },
    },
  );
}
