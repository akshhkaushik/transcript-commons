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

function label(value: string) {
  return value.replaceAll("-", " ");
}

export const metadata: Metadata = {
  title: "Library status",
  description:
    "Public ingestion, provenance, review, and queue status for Transcript Commons.",
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
          <Link href="/policies">Policies</Link>
          <a href="/llms.txt">For agents ↗</a>
        </div>
      </nav>

      <header className="info-hero">
        <p className="eyebrow">PUBLIC OPERATIONS</p>
        <h1>Library status.</h1>
        <p>
          The ingestion queue, transcript provenance, and editorial review state
          are published so people and research agents can judge the collection,
          not merely search it.
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
          <p className="eyebrow">PROVENANCE</p>
          <h2>How text was produced</h2>
          <dl className="status-list">
            {Object.entries(status.sourceCounts).map(([source, count]) => (
              <div key={source}>
                <dt>{label(source)}</dt>
                <dd>{count}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section>
          <p className="eyebrow">EDITORIAL STATE</p>
          <h2>Review queue</h2>
          <dl className="status-list">
            {Object.entries(status.reviewCounts).map(([reviewState, count]) => (
              <div key={reviewState}>
                <dt>{label(reviewState)}</dt>
                <dd>{count}</dd>
              </div>
            ))}
          </dl>
          <p className="status-note">
            Automated medical transcripts remain visibly unreviewed until a
            reviewer checks names, dosages, units, numbers, and source timing.
          </p>
        </section>
      </div>

      <section className="queue-section">
        <div>
          <p className="eyebrow">BATCH QUEUE</p>
          <h2>
            {status.pendingCount
              ? `${status.pendingCount} source videos remain.`
              : "Every queued video is published."}
          </h2>
          <p>
            {status.queuedCount} unique source video
            {status.queuedCount === 1 ? " is" : "s are"} tracked across the
            repository queues.
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

      <section className="operations-links">
        <div>
          <h2>Machine-readable operations</h2>
          <p>
            Status and library objects are static, cacheable, and usable without
            JavaScript, authentication, or an API key.
          </p>
        </div>
        <div className="format-links">
          <a href="/api/health">HEALTH CHECK ↗</a>
          <a href="/data/status.json">STATUS JSON ↗</a>
          <a href="/data/library.json">LIBRARY JSON ↗</a>
          <a href="/data/search-index.json">SEARCH INDEX ↗</a>
          <a href="https://github.com/akshhkaushik/transcript-commons/actions">
            AUTOMATION RUNS ↗
          </a>
        </div>
      </section>

      <footer>
        <Link className="wordmark footer-mark" href="/">
          <span className="wordmark-mark" aria-hidden="true">
            ▶
          </span>
          <span>TRANSCRIPT COMMONS</span>
        </Link>
        <p>
          Generated{" "}
          {status.generatedAt
            ? new Date(status.generatedAt).toISOString().slice(0, 10)
            : "from the current library"}
          .
        </p>
        <Link href="/policies">Corrections and rights →</Link>
      </footer>
    </main>
  );
}
