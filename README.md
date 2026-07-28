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

## Run the website locally

Install Git, Python 3, and Node.js. Then run:

```bash
git clone https://github.com/akshhkaushik/transcript-commons.git
cd transcript-commons
npm install
npm run generate:data
npm run dev:vercel
```

Open [http://localhost:3000](http://localhost:3000).

## Check the project

```bash
npm test
npm run lint
npm run build:vercel
```
