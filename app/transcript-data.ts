import transcriptData from "../content/transcripts.json";

export type TranscriptSegment = {
  start: number;
  duration: number;
  text: string;
};

export type TranscriptQuality = {
  segmentCount: number;
  wordCount: number;
  warnings: string[];
};

export type TranscriptProvenance = {
  pipelineVersion: string;
  fetchedAt: string;
  method: "creator-captions" | "auto-captions" | "local-asr";
  captionLanguage?: string | null;
  engine?: string | null;
  model?: string | null;
  contentSha256: string;
  metadataSeconds?: number;
  processingSeconds?: number;
};

export type TranscriptRecord = {
  schemaVersion?: number;
  videoId: string;
  title: string;
  channel: string;
  channelUrl: string;
  sourceUrl: string;
  thumbnailUrl?: string;
  description: string;
  publishedAt: string;
  durationSeconds: number;
  language: string;
  topics: string[];
  transcriptSource: "creator-captions" | "auto-captions" | "local-asr";
  captionLanguage?: string | null;
  model?: string;
  ingestedAt: string;
  reviewStatus?: "source-captions" | "automated-unreviewed" | "reviewed";
  quality?: TranscriptQuality;
  provenance?: TranscriptProvenance;
  rightsNote?: string;
  segments: TranscriptSegment[];
};

export function getTranscripts(): TranscriptRecord[] {
  return transcriptData as TranscriptRecord[];
}

export function getTranscript(videoId: string) {
  return getTranscripts().find((transcript) => transcript.videoId === videoId);
}

export function transcriptWordCount(transcript: TranscriptRecord) {
  return (
    transcript.quality?.wordCount ??
    transcript.segments.reduce(
      (total, segment) => total + segment.text.split(/\s+/).filter(Boolean).length,
      0,
    )
  );
}
