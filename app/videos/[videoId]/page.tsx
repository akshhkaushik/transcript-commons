import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getTranscript,
  getTranscripts,
  transcriptWordCount,
} from "../../transcript-data";
import { CANONICAL_SITE_ORIGIN, requestOrigin } from "../../site-url";
import {
  durationIso,
  timestamp,
  youtubeUrlAt,
} from "../../transcript-utils";
import "./transcript.css";

function serializeJsonLd(value: unknown) {
  return JSON.stringify(value)
    .replaceAll("<", "\\u003c")
    .replaceAll("\u2028", "\\u2028")
    .replaceAll("\u2029", "\\u2029");
}

export function generateStaticParams() {
  return getTranscripts().map((video) => ({ videoId: video.videoId }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ videoId: string }>;
}): Promise<Metadata> {
  const { videoId } = await params;
  const video = getTranscript(videoId);
  if (!video) return {};

  return {
    title: video.title,
    description: `${video.title} by ${video.channel}: full timestamped transcript and source video.`,
    alternates: {
      canonical: `${CANONICAL_SITE_ORIGIN}/videos/${video.videoId}`,
      types: {
        "text/plain": `${CANONICAL_SITE_ORIGIN}/videos/${video.videoId}/transcript.txt`,
        "application/json": `${CANONICAL_SITE_ORIGIN}/videos/${video.videoId}/transcript.json`,
      },
    },
    openGraph: {
      type: "article",
      title: video.title,
      description: `Full timestamped transcript from ${video.channel}.`,
      images: [
        {
          url:
            video.thumbnailUrl ??
            `https://i.ytimg.com/vi/${video.videoId}/hqdefault.jpg`,
          alt: video.title,
        },
      ],
    },
  };
}

export default async function TranscriptPage({
  params,
}: {
  params: Promise<{ videoId: string }>;
}) {
  const { videoId } = await params;
  const video = getTranscript(videoId);
  if (!video) notFound();

  const origin = await requestOrigin();
  const canonicalUrl = `${origin}/videos/${video.videoId}`;
  const fullText = video.segments.map((segment) => segment.text).join(" ");
  const thumbnailUrl =
    video.thumbnailUrl ??
    `https://i.ytimg.com/vi/${video.videoId}/hqdefault.jpg`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "VideoObject",
        "@id": `${canonicalUrl}#video`,
        name: video.title,
        description: video.description,
        thumbnailUrl: [thumbnailUrl],
        uploadDate: video.publishedAt,
        duration: durationIso(video.durationSeconds),
        embedUrl: `https://www.youtube.com/embed/${video.videoId}`,
        sameAs: video.sourceUrl,
        inLanguage: video.language,
        keywords: video.topics,
        transcript: fullText,
        author: {
          "@type": "Organization",
          name: video.channel,
          url: video.channelUrl || undefined,
        },
        hasPart: video.segments.slice(0, 100).map((segment) => ({
          "@type": "Clip",
          name:
            segment.text.length > 90
              ? `${segment.text.slice(0, 87).trim()}...`
              : segment.text,
          startOffset: Math.floor(segment.start),
          endOffset: Math.max(
            Math.ceil(segment.start + segment.duration),
            Math.floor(segment.start) + 1,
          ),
          url: youtubeUrlAt(video.sourceUrl, segment.start),
        })),
      },
      {
        "@type": "Article",
        "@id": canonicalUrl,
        url: canonicalUrl,
        headline: `${video.title} — timestamped transcript`,
        description: video.description,
        articleBody: fullText,
        datePublished: video.publishedAt || video.ingestedAt,
        dateModified: video.ingestedAt,
        inLanguage: video.language,
        wordCount: transcriptWordCount(video),
        keywords: video.topics,
        isAccessibleForFree: true,
        ...(video.reviewedBy
          ? {
              reviewedBy: {
                "@type": "Organization",
                name: video.reviewedBy,
              },
            }
          : {}),
        mainEntity: { "@id": `${canonicalUrl}#video` },
        isBasedOn: video.sourceUrl,
      },
    ],
  };

  return (
    <main className="transcript-page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />
      <nav className="site-nav">
        <Link className="wordmark" href="/">
          <span className="wordmark-mark" aria-hidden="true">
            ▶
          </span>
          <span>TRANSCRIPT COMMONS</span>
        </Link>
        <Link className="back-link" href="/">
          ← BACK TO INDEX
        </Link>
      </nav>

      <header className="transcript-header">
        <p className="eyebrow">
          {video.channel} <span>•</span> {timestamp(video.durationSeconds)}
        </p>
        <h1>{video.title}</h1>
        <p className="transcript-deck">{video.description}</p>
        <div className="source-actions">
          <a href={video.sourceUrl} rel="noopener noreferrer">
            WATCH SOURCE ↗
          </a>
          <a href={`/videos/${video.videoId}/transcript.txt`}>
            PLAIN TEXT ↗
          </a>
          <a href={`/videos/${video.videoId}/transcript.json`}>JSON ↗</a>
          <a href={`/data/transcripts/${video.videoId}.json`}>
            STATIC JSON ↗
          </a>
        </div>
        <div className="video-frame">
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${video.videoId}`}
            title={`Source video: ${video.title}`}
            loading="lazy"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        </div>
      </header>

      <div className="transcript-layout">
        <aside>
          <dl>
            <div>
              <dt>Channel</dt>
              <dd>
                <a href={video.channelUrl}>{video.channel}</a>
              </dd>
            </div>
            <div>
              <dt>Published</dt>
              <dd>{video.publishedAt}</dd>
            </div>
            <div>
              <dt>Language</dt>
              <dd>{video.language.toUpperCase()}</dd>
            </div>
            <div>
              <dt>Transcript source</dt>
              <dd>{video.transcriptSource.replaceAll("-", " ")}</dd>
            </div>
            <div>
              <dt>Review status</dt>
              <dd>{video.reviewStatus?.replaceAll("-", " ") ?? "unreviewed"}</dd>
            </div>
            {video.reviewedBy ? (
              <div>
                <dt>Reviewed by</dt>
                <dd>{video.reviewedBy}</dd>
              </div>
            ) : null}
            {video.reviewedAt ? (
              <div>
                <dt>Reviewed</dt>
                <dd>{new Date(video.reviewedAt).toISOString().slice(0, 10)}</dd>
              </div>
            ) : null}
            <div>
              <dt>Length</dt>
              <dd>{transcriptWordCount(video).toLocaleString()} words</dd>
            </div>
            {video.model ? (
              <div>
                <dt>ASR model</dt>
                <dd>{video.model}</dd>
              </div>
            ) : null}
          </dl>
          <div className="topic-list">
            {video.topics.map((topic) => (
              <span key={topic}>{topic}</span>
            ))}
          </div>
          {video.quality?.warnings.length ? (
            <div className="quality-note">
              <strong>Quality note</strong>
              {video.quality.warnings.map((warning) => (
                <p key={warning}>{warning}</p>
              ))}
            </div>
          ) : null}
          <div className="citation-note">
            <strong>Cite this record</strong>
            <p>
              {video.channel}. “{video.title}.” <i>Transcript Commons</i>.
              Timestamped transcript of the linked YouTube source.
            </p>
          </div>
          <div className="citation-note">
            <strong>Found an error?</strong>
            <p>
              Read the{" "}
              <Link className="text-link" href="/policies">
                corrections and rights policy
              </Link>{" "}
              to report it.
            </p>
          </div>
        </aside>

        <article className="transcript-body">
          <div className="transcript-label">
            <span>FULL TRANSCRIPT</span>
            <span>{video.segments.length} SEGMENTS</span>
          </div>
          {video.segments.map((segment) => (
            <section className="segment" id={`t-${Math.floor(segment.start)}`} key={segment.start}>
              <a
                className="timestamp"
                href={youtubeUrlAt(video.sourceUrl, segment.start)}
                aria-label={`Open source video at ${timestamp(segment.start)}`}
              >
                {timestamp(segment.start)}
              </a>
              <p>{segment.text}</p>
            </section>
          ))}
        </article>
      </div>

      <footer>
        <Link className="wordmark footer-mark" href="/">
          <span className="wordmark-mark" aria-hidden="true">
            ▶
          </span>
          <span>TRANSCRIPT COMMONS</span>
        </Link>
        <p>Source video rights remain with their respective owners.</p>
        <Link href="/policies">Corrections and rights →</Link>
      </footer>
    </main>
  );
}
