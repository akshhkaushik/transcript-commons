import type { Metadata } from "next";
import Link from "next/link";
import { CANONICAL_SITE_ORIGIN } from "../site-url";

export const metadata: Metadata = {
  title: "Add a missing video transcript",
  description:
    "Run Transcript Commons on your own computer to save a transcript that is missing from the public library.",
  alternates: { canonical: `${CANONICAL_SITE_ORIGIN}/contribute` },
};

const REPOSITORY_URL =
  "https://github.com/akshhkaushik/transcript-commons";

export default function ContributePage() {
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
          <Link href="/status">Library status</Link>
          <Link href="/policies">Corrections</Link>
        </div>
      </nav>

      <header className="info-hero contribute-hero">
        <p className="eyebrow">ADD A MISSING VIDEO</p>
        <h1>Run it on your computer.</h1>
        <p>
          The public website only shows transcripts that have already been
          saved. If a video is missing, run the free project on your own
          computer. It will use existing captions when possible and local
          speech-to-text only when necessary.
        </p>
      </header>

      <section className="contribute-note">
        <strong>Your computer does the work.</strong>
        <p>
          No video or audio is sent to Transcript Commons automatically. The
          transcript is saved in your copy of the project. You can keep it,
          search it locally, or choose to contribute it to the public library.
        </p>
      </section>

      <div className="setup-steps">
        <section>
          <span>01</span>
          <div>
            <p className="eyebrow">DOWNLOAD THE PROJECT</p>
            <h2>Get your own copy.</h2>
            <p>
              Install Git, Python 3, and Node.js, then run these commands in a
              terminal:
            </p>
            <pre>
              <code>{`git clone ${REPOSITORY_URL}.git
cd transcript-commons
npm install`}</code>
            </pre>
          </div>
        </section>

        <section>
          <span>02</span>
          <div>
            <p className="eyebrow">PREPARE YOUR COMPUTER</p>
            <h2>Choose the setup that fits.</h2>
            <div className="setup-options">
              <article>
                <h3>Apple Silicon Mac</h3>
                <p>
                  This helper installs the video tools and MLX Whisper:
                </p>
                <pre>
                  <code>{`chmod +x scripts/setup_mac.sh
./scripts/setup_mac.sh
source .venv/bin/activate`}</code>
                </pre>
              </article>
              <article>
                <h3>Windows, Linux, or another Mac</h3>
                <p>
                  Create a Python environment and install the caption tool:
                </p>
                <pre>
                  <code>{`python -m venv .venv

# macOS or Linux
source .venv/bin/activate

# Windows PowerShell
.venv\\Scripts\\Activate.ps1

python -m pip install yt-dlp`}</code>
                </pre>
                <p>
                  Install FFmpeg, and use{" "}
                  <a
                    className="text-link"
                    href="https://github.com/ggml-org/whisper.cpp"
                  >
                    whisper.cpp
                  </a>{" "}
                  when a video has no captions.
                </p>
              </article>
            </div>
          </div>
        </section>

        <section>
          <span>03</span>
          <div>
            <p className="eyebrow">ADD ONE VIDEO</p>
            <h2>Paste the YouTube URL.</h2>
            <p>
              With the Python environment active, run:
            </p>
            <pre>
              <code>
                {`python scripts/ingest.py "https://www.youtube.com/watch?v=VIDEO_ID"`}
              </code>
            </pre>
            <p>
              The command checks creator captions, then automatic captions. On
              an Apple Silicon Mac it can use MLX Whisper automatically if
              captions are missing.
            </p>
            <p>
              On another system, point the same command to whisper.cpp:
            </p>
            <pre>
              <code>{`python scripts/ingest.py "YOUTUBE_URL" \\
  --engine whisper-cpp \\
  --whisper-cpp /path/to/whisper-cli \\
  --whisper-cpp-model /path/to/ggml-small.en.bin`}</code>
            </pre>
          </div>
        </section>

        <section>
          <span>04</span>
          <div>
            <p className="eyebrow">USE THE SAVED RESULT</p>
            <h2>Search it on your local site.</h2>
            <p>
              The new record is stored in{" "}
              <code className="inline-code">content/transcripts.json</code>.
              Generate the searchable files and start the website:
            </p>
            <pre>
              <code>{`npm run generate:data
npm run dev:vercel`}</code>
            </pre>
            <p>
              Open <code className="inline-code">http://localhost:3000</code>.
              The transcript remains available in that project until you
              remove it. Run the add-video command again whenever you want to
              save another video.
            </p>
          </div>
        </section>

        <section>
          <span>05</span>
          <div>
            <p className="eyebrow">OPTIONAL</p>
            <h2>Share it with the public library.</h2>
            <p>
              Check names, numbers, and important details against the original
              video. Then submit the changed transcript files through a GitHub
              pull request. Nothing is published without that deliberate step.
            </p>
            <div className="local-actions">
              <a className="primary-action" href={`${REPOSITORY_URL}/fork`}>
                FORK THE PROJECT ↗
              </a>
              <a
                className="secondary-action"
                href={`${REPOSITORY_URL}/issues/new/choose`}
              >
                ASK FOR HELP ↗
              </a>
            </div>
          </div>
        </section>
      </div>

      <section className="saved-result">
        <div>
          <p className="eyebrow">WHAT GETS SAVED?</p>
          <h2>One reusable transcript record.</h2>
        </div>
        <ul>
          <li>Video title, channel, and original link</li>
          <li>Clean text with timestamps</li>
          <li>Topics and searchable words</li>
          <li>How the transcript was created</li>
          <li>Plain-text and JSON copies for later use</li>
        </ul>
      </section>

      <footer>
        <Link className="wordmark footer-mark" href="/">
          <span className="wordmark-mark" aria-hidden="true">
            ▶
          </span>
          <span>TRANSCRIPT COMMONS</span>
        </Link>
        <p>Run locally. Keep the result. Share it only when ready.</p>
        <Link href="/">Search the library →</Link>
      </footer>
    </main>
  );
}
