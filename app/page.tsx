import type { Metadata } from "next";
import Link from "next/link";
import { getTranscripts } from "./transcript-data";
import {
  excerpt,
  searchTranscripts,
  timestamp,
} from "./transcript-utils";

export const metadata: Metadata = {
  title: "Transcript Commons — YouTube, made searchable",
  description:
    "A free, public, agent-readable library of timestamped YouTube transcripts.",
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
          <a href="/llms.txt">For agents ↗</a>
        </div>
      </nav>

      <section className="hero" aria-labelledby="hero-title">
        <div className="hero-copy">
          <p className="eyebrow">
            OPEN KNOWLEDGE LAYER <span>•</span> HEALTHCARE FIRST
          </p>
          <h1 id="hero-title">
            YouTube,
            <br />
            made <em>searchable.</em>
          </h1>
          <p className="hero-description">
            Clean, timestamped transcripts that people can read and research
            agents can find, quote, and reason over. Free. Public. No login.
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
              placeholder="Search every transcript…"
              autoComplete="off"
            />
            <button type="submit">SEARCH</button>
          </form>
          <div className="quick-links" aria-label="Quick topic links">
            <span>START WITH</span>
            <Link href="/?q=diabetes">Diabetes</Link>
            <Link href="/?q=cardiology">Cardiology</Link>
            <Link href="/?q=mental+health">Mental health</Link>
          </div>
        </div>

        <div className="hero-index" aria-label="Transcript index illustration">
          <div className="index-top">
            <span>LIVE INDEX</span>
            <span>{String(transcripts.length).padStart(3, "0")} RECORDS</span>
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
            <strong>CAPTIONS FIRST</strong>
            <span>LOCAL ASR FALLBACK</span>
          </p>
        </div>
      </section>

      <section className="manifesto" aria-label="Library promise">
        <p>THE VIDEO IS THE SOURCE.</p>
        <p>THE TRANSCRIPT MAKES IT LEGIBLE.</p>
        <p>THE OPEN WEB MAKES IT USEFUL.</p>
      </section>

      <section className="library-section" id="library">
        <div className="section-heading">
          <div>
            <p className="eyebrow">THE PUBLIC INDEX</p>
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
              <strong>100%</strong> open
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
            <div className="empty-number">{query ? "0" : "01"}</div>
            <div>
              <p className="eyebrow">
                {query ? "NO MATCHES YET" : "INDEX READY"}
              </p>
              <h3>
                {query
                  ? "This search will grow with the library."
                  : "Send the first healthcare URLs."}
              </h3>
              <p>
                {query
                  ? "Try a broader medical topic, channel name, or phrase."
                  : "The ingestion pipeline is ready to reuse existing captions or transcribe audio locally when captions are missing."}
              </p>
            </div>
          </div>
        )}
      </section>

      <section className="process-section" id="how-it-works">
        <div className="process-intro">
          <p className="eyebrow">FROM VIDEO TO OPEN TEXT</p>
          <h2>Two paths in. One clean record out.</h2>
          <p>
            Every page keeps the source video attached to its words. Timestamps,
            provenance, and machine-readable formats are part of the record—not
            an afterthought.
          </p>
        </div>
        <ol className="process-list">
          <li>
            <span>01</span>
            <div>
              <h3>Use captions</h3>
              <p>
                Fetch creator or auto-generated captions and normalize overlapping
                cues into readable, timestamped segments.
              </p>
            </div>
            <b>FAST PATH</b>
          </li>
          <li>
            <span>02</span>
            <div>
              <h3>Transcribe locally</h3>
              <p>
                If captions are absent, download audio and run MLX Whisper or
                whisper.cpp on your Mac. Audio never needs a paid cloud model.
              </p>
            </div>
            <b>FALLBACK</b>
          </li>
          <li>
            <span>03</span>
            <div>
              <h3>Publish for agents</h3>
              <p>
                Render semantic HTML, plain text, JSON, canonical URLs, structured
                data, and sitemaps so web research tools can discover the words.
              </p>
            </div>
            <b>OPEN WEB</b>
          </li>
        </ol>
      </section>

      <section className="agent-section">
        <div className="agent-kicker">AGENT-READABLE BY DESIGN</div>
        <h2>
          No player scraping.
          <br />
          No code required.
          <br />
          <em>Just a URL.</em>
        </h2>
        <p>
          Each transcript is fully server-rendered and available as clean HTML,
          text, and JSON. ChatGPT, Claude, search engines, and ordinary browsers
          all get the same open source record.
        </p>
        <div className="format-links">
          <a href="/llms.txt">LLMS.TXT ↗</a>
          <a href="/api/transcripts">JSON INDEX ↗</a>
          <a href="/api/search?q=diabetes">SEARCH API ↗</a>
          <a href="/sitemap.xml">SITEMAP ↗</a>
        </div>
      </section>

      <footer>
        <Link className="wordmark footer-mark" href="/">
          <span className="wordmark-mark" aria-hidden="true">
            ▶
          </span>
          <span>TRANSCRIPT COMMONS</span>
        </Link>
        <p>Free transcripts for humans and research agents.</p>
        <p>Built in public. Healthcare first.</p>
      </footer>
    </main>
  );
}
