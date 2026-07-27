import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { getTranscripts } from "./transcript-data";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const protocol =
    requestHeaders.get("x-forwarded-proto") ??
    (host?.includes("localhost") ? "http" : "https");
  const origin = host
    ? `${protocol}://${host}`
    : "https://transcript-commons.sites.openai.com";

  return [
    {
      url: origin,
      changeFrequency: "daily",
      priority: 1,
    },
    ...getTranscripts().map((video) => ({
      url: `${origin}/videos/${video.videoId}`,
      lastModified: new Date(video.ingestedAt),
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
  ];
}
