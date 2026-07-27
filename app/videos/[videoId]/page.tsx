import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranscript, getTranscripts } from "../../transcript-data";
import "./transcript.css";

function timestamp(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  return hours
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`
    : `${minutes}:${String(secs).padStart(2, "0")}`;
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
    alternates: { canonical: `/videos/${video.videoId}` },
    openGraph: {
      type: "article",
      title: video.title,
      description: `Full timestamped transcript from ${video.channel}.`,
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

  const fullText = video.segments.map((segment) => segment.text).join(" ");
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "VideoObject",
    name: video.title,
    description: video.description,
    uploadDate: video.publishedAt,
    duration: `PT${video.durationSeconds}S`,
    contentUrl: video.sourceUrl,
    embedUrl: `https://www.youtube.com/embed/${video.videoId}`,
    transcript: fullText,
    author: {
      "@type": "Organization",
      name: video.channel,
      url: video.channelUrl,
    },
  };

  return (
    <main className="transcript-page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
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
                href={`${video.sourceUrl}&t=${Math.floor(segment.start)}s`}
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
        <p>Open text for better research.</p>
      </footer>
    </main>
  );
}
