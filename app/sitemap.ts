import type { MetadataRoute } from "next";
import { getTranscripts } from "./transcript-data";
import { requestOrigin } from "./site-url";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = await requestOrigin();

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
