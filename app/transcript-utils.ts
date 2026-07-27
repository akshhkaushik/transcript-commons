import type { TranscriptRecord } from "./transcript-data";

export function timestamp(seconds: number) {
  const whole = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(whole / 3600);
  const minutes = Math.floor((whole % 3600) / 60);
  const secs = whole % 60;
  return hours
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`
    : `${minutes}:${String(secs).padStart(2, "0")}`;
}

export function durationIso(seconds: number) {
  const whole = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(whole / 3600);
  const minutes = Math.floor((whole % 3600) / 60);
  const secs = whole % 60;
  return `PT${hours ? `${hours}H` : ""}${minutes ? `${minutes}M` : ""}${secs || (!hours && !minutes) ? `${secs}S` : ""}`;
}

export function youtubeUrlAt(sourceUrl: string, seconds: number) {
  try {
    const url = new URL(sourceUrl);
    url.searchParams.set("t", `${Math.max(0, Math.floor(seconds))}s`);
    return url.toString();
  } catch {
    const separator = sourceUrl.includes("?") ? "&" : "?";
    return `${sourceUrl}${separator}t=${Math.max(0, Math.floor(seconds))}s`;
  }
}

export type SearchHit = {
  transcript: TranscriptRecord;
  match?: {
    start: number;
    text: string;
  };
};

export function searchTranscripts(
  transcripts: TranscriptRecord[],
  rawQuery: string,
): SearchHit[] {
  const query = rawQuery.trim().toLocaleLowerCase();
  if (!query) return transcripts.map((transcript) => ({ transcript }));

  return transcripts.flatMap((transcript) => {
    const metadata = [
      transcript.title,
      transcript.channel,
      transcript.description,
      transcript.topics.join(" "),
    ]
      .join(" ")
      .toLocaleLowerCase();
    const matchingSegment = transcript.segments.find((segment) =>
      segment.text.toLocaleLowerCase().includes(query),
    );
    if (!metadata.includes(query) && !matchingSegment) return [];
    return [
      {
        transcript,
        match: matchingSegment
          ? { start: matchingSegment.start, text: matchingSegment.text }
          : undefined,
      },
    ];
  });
}

export function excerpt(text: string, query: string, limit = 220) {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= limit) return normalized;
  const index = normalized.toLocaleLowerCase().indexOf(query.toLocaleLowerCase());
  const start = Math.max(0, index >= 0 ? index - Math.floor(limit / 3) : 0);
  const end = Math.min(normalized.length, start + limit);
  return `${start ? "…" : ""}${normalized.slice(start, end).trim()}${end < normalized.length ? "…" : ""}`;
}
