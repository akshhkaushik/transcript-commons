import type { Metadata } from "next";
import Link from "next/link";
import { CANONICAL_SITE_ORIGIN } from "../site-url";

const CONTACT_EMAIL = "aksh.heisenberg@gmail.com";
const ISSUES_URL =
  "https://github.com/akshhkaushik/transcript-commons/issues/new/choose";

export const metadata: Metadata = {
  title: "Corrections and removal",
  description:
    "How to report a transcript mistake or ask for a transcript to be removed.",
  alternates: { canonical: `${CANONICAL_SITE_ORIGIN}/policies` },
};

export default function PoliciesPage() {
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
          <Link href="/status">Library status</Link>
        </div>
      </nav>

      <header className="info-hero">
        <p className="eyebrow">HELP KEEP THE LIBRARY ACCURATE</p>
        <h1>Corrections and removal.</h1>
        <p>
          Transcripts can contain mistakes. Tell us what needs to change, or
          contact us privately if you own a source and want its transcript
          removed.
        </p>
      </header>

      <div className="policy-grid">
        <section>
          <span>01</span>
          <div>
            <h2>The original video remains the source</h2>
            <p>
              The video and its media belong to their original publisher.
              Transcript Commons is independent from YouTube and the listed
              channels. Every transcript links back to the original video and
              says how its text was created.
            </p>
          </div>
        </section>

        <section>
          <span>02</span>
          <div>
            <h2>Report a transcript mistake</h2>
            <p>
              Send the transcript link, timestamp, incorrect words, and the
              correct words. Please check names, numbers, and important claims
              against the original video first.
            </p>
            <p>
              <a className="text-link" href={ISSUES_URL}>
                Open a correction request ↗
              </a>
            </p>
          </div>
        </section>

        <section>
          <span>03</span>
          <div>
            <h2>Ask for removal</h2>
            <p>
              If you own or publish the source, email the source link,
              transcript link, your relationship to the video, and the action
              you want. Use email so private information is not posted publicly.
            </p>
            <p>
              <a className="text-link" href={`mailto:${CONTACT_EMAIL}`}>
                Email a private takedown request ↗
              </a>
            </p>
          </div>
        </section>

        <section>
          <span>04</span>
          <div>
            <h2>Check important information</h2>
            <p>
              Captions and speech-to-text can mishear words. A transcript shows
              what the source appears to say; it does not prove that the claim
              is correct. Use the timestamp to check the original video before
              relying on important information.
            </p>
          </div>
        </section>
      </div>

      <footer>
        <Link className="wordmark footer-mark" href="/">
          <span className="wordmark-mark" aria-hidden="true">
            ▶
          </span>
          <span>TRANSCRIPT COMMONS</span>
        </Link>
        <p>Free to read. Easy to correct. Linked to the source.</p>
        <Link href="/">Search the library →</Link>
      </footer>
    </main>
  );
}
