import type { Metadata } from "next";
import Link from "next/link";
import { getTranscripts } from "./transcript-data";
import { CANONICAL_SITE_ORIGIN } from "./site-url";
import {
  excerpt,
  searchTranscripts,
  timestamp,
} from "./transcript-utils";

export const metadata: Metadata = {
  title: "Transcript Commons — Search video transcripts",
  description:
    "Read and search free, timestamped YouTube transcripts. If a video is missing, create its transcript on your own computer.",
  alternates: { canonical: CANONICAL_SITE_ORIGIN },
};

function formatDuration(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return hours
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`
    : `${minutes}:${String(secs).padStart(2, "0")}`;
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const transcripts = getTranscripts();
  const query = q.trim().toLowerCase();
  const results = searchTranscripts(transcripts, query);
  const totalHours = Math.round(
    transcripts.reduce((total, video) => total + video.durationSeconds, 0) / 3600,
  );

  return (
    <main>
      <nav className="site-nav" aria-label="Main navigation">
        <Link className="wordmark" href="/" aria-label="Transcript Commons home">
          <span className="wordmark-mark" aria-hidden="true">
            ▶
          </span>
          <span>TRANSCRIPT COMMONS</span>
        </Link>
        <div className="nav-links">
          <a href="#library">Library</a>
          <a href="#how-it-works">How it works</a>
          <Link href="/contribute">Add a transcript</Link>
        </div>
      </nav>

      <section className="hero" aria-labelledby="hero-title">
        <div className="hero-copy">
          <p className="eyebrow">FREE PUBLIC VIDEO TRANSCRIPTS</p>
          <h1 id="hero-title">
            Video,
            <br />
            made <em>searchable.</em>
          </h1>
          <p className="hero-description">
            Find a video, read what was said, and jump back to the exact moment.
            Every transcript is free to search and read. No account required.
          </p>
          <form className="search" action="/" role="search">
            <label className="sr-only" htmlFor="q">
              Search every transcript
            </label>
            <input
              id="q"
              name="q"
              type="search"
              defaultValue={q}
              placeholder="Search titles, topics, or spoken words…"
              autoComplete="off"
            />
            <button type="submit">SEARCH</button>
          </form>
          <div className="quick-links">
            <span>TRY</span>
            <Link href="/?q=diabetes">Diabetes</Link>
            <Link href="/?q=insulin">Insulin</Link>
            <Link href="/?q=screening">Screening</Link>
          </div>
        </div>

        <div className="hero-index" aria-label="Transcript index illustration">
          <div className="index-top">
            <span>PUBLIC LIBRARY</span>
            <span>{String(transcripts.length).padStart(3, "0")} VIDEOS</span>
          </div>
          <div className="play-block">
            <span aria-hidden="true">▶</span>
          </div>
          <div className="index-lines" aria-hidden="true">
            {["00:00", "01:24", "03:47", "06:15", "09:02", "12:33"].map(
              (time, index) => (
                <div className="index-line" key={time}>
                  <span>{time}</span>
                  <i style={{ width: `${84 - index * 7}%` }} />
                </div>
              ),
            )}
          </div>
          <p>
            <strong>USE CAPTIONS FIRST</strong>
            <span>TRANSCRIBE ONLY WHEN NEEDED</span>
          </p>
        </div>
      </section>

      <section className="manifesto" aria-label="Library promise">
        <p>SEARCH THE WORDS.</p>
        <p>OPEN THE TIMESTAMP.</p>
        <p>CHECK THE ORIGINAL VIDEO.</p>
      </section>

      <section className="library-section" id="library">
        <div className="section-heading">
          <div>
            <p className="eyebrow">THE LIBRARY</p>
            <h2>{query ? `Results for “${q}”` : "Latest transcripts"}</h2>
          </div>
          <div className="stats" aria-label="Library statistics">
            <span>
              <strong>{transcripts.length}</strong> videos
            </span>
            <span>
              <strong>{totalHours}</strong> hours
            </span>
            <span>
              <strong>Free</strong> access
            </span>
          </div>
        </div>

        {results.length ? (
          <div className="transcript-grid">
            {results.map(({ transcript: video, match }, resultIndex) => (
              <article className="transcript-card" key={video.videoId}>
                <div className="card-number" aria-hidden="true">
                  {String(resultIndex + 1).padStart(2, "0")}
                </div>
                <div>
                  <p className="card-meta">
                    {video.channel} <span>•</span>{" "}
                    {formatDuration(video.durationSeconds)}
                  </p>
                  <h3>
                    <Link href={`/videos/${video.videoId}`}>{video.title}</Link>
                  </h3>
                  <p className="card-description">{video.description}</p>
                  {match ? (
                    <p className="search-match">
                      <span>{timestamp(match.start)}</span>
                      {excerpt(match.text, query)}
                    </p>
                  ) : null}
                  <div className="topic-list">
                    {video.topics.map((topic) => (
                      <span key={topic}>{topic}</span>
                    ))}
                  </div>
                </div>
                <Link
                  className="card-arrow"
                  href={`/videos/${video.videoId}`}
                  aria-label={`Read ${video.title}`}
                >
                  ↗
                </Link>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-number">0</div>
            <div>
              <p className="eyebrow">NO MATCH YET</p>
              <h3>That video or topic is not in the library.</h3>
              <p>
                Try a shorter search, or{" "}
                <Link className="text-link" href="/contribute">
                  create the missing transcript on your computer
                </Link>
                .
              </p>
            </div>
          </div>
        )}
      </section>

      <section className="process-section" id="how-it-works">
        <div className="process-intro">
          <p className="eyebrow">HOW IT WORKS</p>
          <h2>A video becomes useful text.</h2>
          <p>
            The library tries the easiest method first and always keeps the
            finished transcript connected to the original video.
          </p>
        </div>
        <ol className="process-list">
          <li>
            <span>01</span>
            <div>
              <h3>Use available captions</h3>
              <p>
                If the video already has captions, they are cleaned and saved
                with readable timestamps.
              </p>
            </div>
          </li>
          <li>
            <span>02</span>
            <div>
              <h3>Fill the gap locally</h3>
              <p>
                If captions are missing, anyone can run a free speech-to-text
                model on their own computer. The work is not tied to one person
                or one machine.
              </p>
            </div>
          </li>
          <li>
            <span>03</span>
            <div>
              <h3>Save it for later</h3>
              <p>
                The result stays in the project, where it can be searched,
                checked, reused, or contributed to the public library.
              </p>
            </div>
          </li>
        </ol>
      </section>

      <section className="local-section">
        <div>
          <p className="eyebrow">VIDEO NOT FOUND?</p>
          <h2>Add it from your own computer.</h2>
          <p>
            Download the open-source project, give it a YouTube URL, and let it
            use captions or local transcription. Nothing is automatically
            uploaded. You decide whether the saved result stays private or is
            shared with the library.
          </p>
          <div className="local-actions">
            <Link className="primary-action" href="/contribute">
              SEE THE SIMPLE GUIDE →
            </Link>
            <a
              className="secondary-action"
              href="https://github.com/akshhkaushik/transcript-commons"
            >
              VIEW THE PROJECT ↗
            </a>
          </div>
        </div>
        <div className="command-card" aria-label="Example local command">
          <span>ONE VIDEO</span>
          <code>python scripts/ingest.py &quot;YOUTUBE_URL&quot;</code>
          <p>Captions first. Local transcription only when needed.</p>
        </div>
      </section>

      <section className="agent-section">
        <div className="agent-kicker">USEFUL TO PEOPLE AND AI TOOLS</div>
        <h2>
          Read the words.
          <br />
          Check the source.
          <br />
          <em>Share the page.</em>
        </h2>
        <p>
          Each public page contains the complete transcript, timestamps, and a
          link to the original video. It works in an ordinary browser and can
          also be read by web research tools.
        </p>
        <div className="format-links">
          <a href="/llms.txt">GUIDE FOR AI TOOLS ↗</a>
          <a href="/api/transcripts">PUBLIC DATA ↗</a>
        </div>
      </section>

      <footer>
        <Link className="wordmark footer-mark" href="/">
          <span className="wordmark-mark" aria-hidden="true">
            ▶
          </span>
          <span>TRANSCRIPT COMMONS</span>
        </Link>
        <p>Free video transcripts that stay linked to their source.</p>
        <p>
          <Link href="/contribute">Add a transcript</Link> ·{" "}
          <Link href="/policies">Corrections or removal</Link>
        </p>
      </footer>
    </main>
  );
}
