# Transcript Commons

Transcript Commons is a free website for reading and searching YouTube video
transcripts. Every transcript includes timestamps and a link to the original
video.

Public website: [transcript-commons.vercel.app](https://transcript-commons.vercel.app)

## Use the website

1. Search for a topic or video.
2. Open a result.
3. Read the transcript or click a timestamp to check the original video.

There are no accounts, subscriptions, or payments.

## Add a video that is missing

Run this project on your own computer. It first tries the video's existing
captions. If captions are unavailable, it can use a free local speech-to-text
model.

Nothing is uploaded automatically. The finished transcript is stored in your
copy of the project, so you can keep it and use it again.

### 1. Download the project

Install Git, Python 3, and Node.js. Then run:

```bash
git clone https://github.com/akshhkaushik/transcript-commons.git
cd transcript-commons
npm install
```

### 2. Prepare your computer

On an Apple Silicon Mac:

```bash
chmod +x scripts/setup_mac.sh
./scripts/setup_mac.sh
source .venv/bin/activate
```

This installs the video tools and MLX Whisper.

On Windows, Linux, or another Mac:

```bash
python -m venv .venv
```

Activate it on macOS or Linux:

```bash
source .venv/bin/activate
```

Or activate it in Windows PowerShell:

```powershell
.venv\Scripts\Activate.ps1
```

Then install the caption tool:

```bash
python -m pip install yt-dlp
```

Install FFmpeg as well. For videos without captions, install
[whisper.cpp](https://github.com/ggml-org/whisper.cpp) and download one of its
models.

### 3. Add one video

```bash
python scripts/ingest.py "https://www.youtube.com/watch?v=VIDEO_ID"
```

On a system using whisper.cpp:

```bash
python scripts/ingest.py "YOUTUBE_URL" \
  --engine whisper-cpp \
  --whisper-cpp /path/to/whisper-cli \
  --whisper-cpp-model /path/to/ggml-small.en.bin
```

Run the same command again with another URL to add more videos.

### 4. Open your saved library

The transcript is saved in `content/transcripts.json`.

```bash
npm run generate:data
npm run dev:vercel
```

Open [http://localhost:3000](http://localhost:3000). Your saved transcripts will
remain there until you remove them.

## Share a transcript

You can keep the result only on your computer, or contribute it to the public
website with a GitHub pull request. Check names, numbers, and important details
against the original video before sharing.

The full browser guide is at
[transcript-commons.vercel.app/contribute](https://transcript-commons.vercel.app/contribute).

## Check the project

```bash
npm test
npm run lint
npm run build:vercel
```
