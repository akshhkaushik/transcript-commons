import statusData from "../../../content/library-status.json";
import { canonicalHeaders } from "../../site-url";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return Response.json(
    {
      ok: true,
      service: "transcript-commons",
      canonicalOrigin: statusData.canonicalOrigin,
      generatedAt: statusData.generatedAt,
      publishedCount: statusData.publishedCount,
      pendingCount: statusData.pendingCount,
      automatedUnreviewed:
        statusData.reviewCounts["automated-unreviewed"] ?? 0,
    },
    {
      headers: {
        "cache-control": "no-store",
        ...canonicalHeaders("/api/health", request.url),
      },
    },
  );
}
