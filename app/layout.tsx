import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const protocol =
    requestHeaders.get("x-forwarded-proto") ??
    (host?.includes("localhost") ? "http" : "https");
  const origin = host
    ? `${protocol}://${host}`
    : "https://transcript-commons.sites.openai.com";

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
