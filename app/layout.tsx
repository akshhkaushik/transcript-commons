import type { Metadata } from "next";
import "./globals.css";
import {
  CANONICAL_SITE_ORIGIN,
  currentRequestOrigin,
  requestOrigin,
} from "./site-url";

export async function generateMetadata(): Promise<Metadata> {
  const origin = await requestOrigin();
  const requestOriginValue = await currentRequestOrigin();
  const isCanonicalHost =
    requestOriginValue === CANONICAL_SITE_ORIGIN ||
    requestOriginValue.includes("localhost");

  return {
    metadataBase: new URL(origin),
    title: {
      default: "Transcript Commons — YouTube, made searchable",
      template: "%s | Transcript Commons",
    },
    description:
      "A free, public, agent-readable library of timestamped YouTube transcripts.",
    applicationName: "Transcript Commons",
    keywords: [
      "YouTube transcripts",
      "video transcripts",
      "healthcare research",
      "agent-readable",
      "open knowledge",
    ],
    alternates: { canonical: "/" },
    robots: {
      index: isCanonicalHost,
      follow: true,
      googleBot: {
        index: isCanonicalHost,
        follow: true,
        "max-snippet": -1,
        "max-image-preview": "large",
        "max-video-preview": -1,
      },
    },
    icons: {
      icon: "/favicon.svg",
      shortcut: "/favicon.svg",
    },
    openGraph: {
      type: "website",
      siteName: "Transcript Commons",
      title: "Transcript Commons",
      description: "YouTube, made searchable.",
      url: origin,
      images: [
        {
          url: `${origin}/og.png`,
          width: 1536,
          height: 1024,
          alt: "Transcript Commons — YouTube, made searchable.",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: "Transcript Commons",
      description: "YouTube, made searchable.",
      images: [`${origin}/og.png`],
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
