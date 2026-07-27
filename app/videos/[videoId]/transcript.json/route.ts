import { getTranscript } from "../../../transcript-data";
import {
  CANONICAL_SITE_ORIGIN,
  canonicalHeaders,
} from "../../../site-url";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ videoId: string }> },
) {
  const { videoId } = await params;
  const video = getTranscript(videoId);
  if (!video) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json(
    {
      $schema: `${CANONICAL_SITE_ORIGIN}/transcript-schema.json`,
      ...video,
    },
    {
      headers: {
        "cache-control": "public, max-age=300, s-maxage=86400",
        ...canonicalHeaders(
          `/videos/${video.videoId}/transcript.json`,
          request.url,
        ),
      },
    },
  );
}
