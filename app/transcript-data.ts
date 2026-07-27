import transcriptData from "../content/transcripts.json";

export type TranscriptSegment = {
  start: number;
  duration: number;
  text: string;
};

export type TranscriptRecord = {
  videoId: string;
  title: string;
  channel: string;
  channelUrl: string;
  sourceUrl: string;
  description: string;
  publishedAt: string;
  durationSeconds: number;
  language: string;
  topics: string[];
  transcriptSource: "creator-captions" | "auto-captions" | "local-asr";
  model?: string;
  ingestedAt: string;
  segments: TranscriptSegment[];
};

export function getTranscripts(): TranscriptRecord[] {
  return transcriptData as TranscriptRecord[];
}

export function getTranscript(videoId: string) {
  return getTranscripts().find((transcript) => transcript.videoId === videoId);
}
