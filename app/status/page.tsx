import type { Metadata } from "next";
import Link from "next/link";
import statusData from "../../content/library-status.json";
import { CANONICAL_SITE_ORIGIN } from "../site-url";

type LibraryStatus = {
  generatedAt: string;
  canonicalOrigin: string;
  publishedCount: number;
  queuedCount: number;
  pendingCount: number;
  totalDurationSeconds: number;
  totalWordCount: number;
  sourceCounts: Record<string, number>;
  reviewCounts: Record<string, number>;
  pending: {
    videoId: string;
    url: string;
    title: string;
    channel: string;
  }[];
};

const status = statusData as LibraryStatus;

function hours(seconds: number) {
  return (seconds / 3600).toFixed(1);
}

const sourceLabels: Record<string, string> = {
  "creator-captions": "Provided captions",
  "auto-captions": "Automatic captions",
  "local-asr": "Local transcription",
};

const reviewLabels: Record<string, string> = {
  reviewed: "Checked against the video",
  "automated-unreviewed": "Needs a manual check",
};

function label(value: string, labels: Record<string, string>) {
  return labels[value] ?? value.replaceAll("-", " ");
}

export const metadata: Metadata = {
  title: "Library status",
  description:
    "See how many transcripts are available and how they were created.",
  alternates: { canonical: `${CANONICAL_SITE_ORIGIN}/status` },
};

export default function StatusPage() {
  return (
    <main className="info-page">
      <nav className="site-nav" aria-label="Main navigation">
        <Link className="wordmark" href="/">
          <span className="wordmark-mark" aria-hidden="true">
            ▶
          </span>
          <span>TRANSCRIPT COMMONS</span>
        </Link>
        <div className="nav-links">
          <Link href="/">Library</Link>
          <Link href="/contribute">Add a transcript</Link>
          <Link href="/policies">Corrections</Link>
        </div>
      </nav>

      <header className="info-hero">
        <p className="eyebrow">WHAT IS IN THE LIBRARY?</p>
        <h1>Library at a glance.</h1>
        <p>
          See how many videos are ready, how the text was made, and whether it
          has been checked against the original video.
        </p>
      </header>

      <section className="status-metrics" aria-label="Library totals">
        <article>
          <strong>{status.publishedCount}</strong>
          <span>published videos</span>
        </article>
        <article>
          <strong>{status.pendingCount}</strong>
          <span>pending queue items</span>
        </article>
        <article>
          <strong>{status.totalWordCount.toLocaleString()}</strong>
          <span>searchable words</span>
        </article>
        <article>
          <strong>{hours(status.totalDurationSeconds)}</strong>
          <span>source hours</span>
        </article>
      </section>

      <div className="status-grid">
        <section>
          <p className="eyebrow">HOW THE TEXT WAS MADE</p>
          <h2>Transcript sources</h2>
          <dl className="status-list">
            {Object.entries(status.sourceCounts).map(([source, count]) => (
              <div key={source}>
                <dt>{label(source, sourceLabels)}</dt>
                <dd>{count}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section>
          <p className="eyebrow">ACCURACY CHECK</p>
          <h2>What has been checked</h2>
          <dl className="status-list">
            {Object.entries(status.reviewCounts).map(([reviewState, count]) => (
              <div key={reviewState}>
                <dt>{label(reviewState, reviewLabels)}</dt>
                <dd>{count}</dd>
              </div>
            ))}
          </dl>
          <p className="status-note">
            Automatic text can mishear names and numbers. Records stay marked
            as needing a check until someone compares them with the video.
          </p>
        </section>
      </div>

      <section className="queue-section">
        <div>
          <p className="eyebrow">VIDEOS WAITING TO BE ADDED</p>
          <h2>
            {status.pendingCount
              ? `${status.pendingCount} source videos remain.`
              : "Every queued video is published."}
          </h2>
          <p>
            {status.queuedCount} unique source video
            {status.queuedCount === 1 ? " is" : "s are"} currently listed.
          </p>
        </div>
        {status.pending.length ? (
          <ol>
            {status.pending.map((item) => (
              <li key={item.videoId}>
                <a href={item.url}>{item.title || item.videoId}</a>
                {item.channel ? <span>{item.channel}</span> : null}
              </li>
            ))}
          </ol>
        ) : (
          <div className="queue-complete" aria-label="Queue complete">
            ✓
          </div>
        )}
      </section>

      <footer>
        <Link className="wordmark footer-mark" href="/">
          <span className="wordmark-mark" aria-hidden="true">
            ▶
          </span>
          <span>TRANSCRIPT COMMONS</span>
        </Link>
        <p>Want another video here? Run the project on your computer.</p>
        <Link href="/contribute">Add a transcript →</Link>
      </footer>
    </main>
  );
}
