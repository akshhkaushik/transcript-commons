import type { Metadata } from "next";
import Link from "next/link";

const CONTACT_EMAIL = "aksh.heisenberg@gmail.com";
const ISSUES_URL =
  "https://github.com/akshhkaushik/transcript-commons/issues/new/choose";

export const metadata: Metadata = {
  title: "Rights, corrections, and takedowns",
  description:
    "Transcript Commons policies for source attribution, medical accuracy, corrections, privacy, and takedown requests.",
  alternates: { canonical: "/policies" },
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
          <Link href="/status">Status</Link>
          <a href="/llms.txt">For agents ↗</a>
        </div>
      </nav>

      <header className="info-hero">
        <p className="eyebrow">PUBLIC OPERATING POLICY</p>
        <h1>Rights, corrections, and takedowns.</h1>
        <p>
          Transcript Commons is an independent, free research index. Every
          transcript stays attached to its original YouTube source, publisher,
          timestamps, and production method.
        </p>
      </header>

      <div className="policy-grid">
        <section>
          <span>01</span>
          <div>
            <h2>Source rights and attribution</h2>
            <p>
              Source videos, audio, thumbnails, names, and underlying media
              remain the property of their respective publishers. Transcript
              Commons does not claim ownership of source media and is not
              affiliated with YouTube or the indexed channels.
            </p>
            <p>
              Each record links directly to the source video and identifies
              whether its text came from creator captions, automatic captions,
              or local speech recognition.
            </p>
          </div>
        </section>

        <section>
          <span>02</span>
          <div>
            <h2>Corrections</h2>
            <p>
              Report transcription errors with the transcript URL, timestamp,
              incorrect text, and proposed correction. Medical names, dosages,
              numerical claims, and speaker identity receive priority.
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
            <h2>Takedowns and publisher requests</h2>
            <p>
              Rights holders and source publishers may request removal or
              amendment. Include the source URL, the transcript URL, your
              relationship to the work, and the requested action. Do not put
              confidential personal information in a public GitHub issue.
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
            <h2>Medical accuracy</h2>
            <p>
              A transcript is a representation of what a source says—not an
              endorsement or verification of its medical claims. Automated
              captions and speech recognition can misstate names, medication,
              units, and numbers. Review the linked source and qualified
              evidence before making a health decision.
            </p>
          </div>
        </section>

        <section>
          <span>05</span>
          <div>
            <h2>Privacy and access</h2>
            <p>
              Reading the library requires no account, payment, or
              subscription. The application does not provide user profiles or
              sell personal data. Hosting providers may retain standard
              security and access logs under their own platform policies.
            </p>
          </div>
        </section>

        <section>
          <span>06</span>
          <div>
            <h2>Contact</h2>
            <p>
              Public technical and correction requests belong in the GitHub
              issue tracker. Private rights or takedown requests can be sent to{" "}
              <a className="text-link" href={`mailto:${CONTACT_EMAIL}`}>
                {CONTACT_EMAIL}
              </a>
              .
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
        <p>Transparent provenance. Correctable text. Open access.</p>
        <Link href="/status">Library status →</Link>
      </footer>
    </main>
  );
}
