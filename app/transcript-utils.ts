import searchIndexData from "../content/search-index.json";
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

const STOP_WORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "been", "but", "by", "for",
  "from", "had", "has", "have", "he", "her", "his", "i", "in", "is", "it",
  "its", "of", "on", "or", "our", "she", "that", "the", "their", "they",
  "this", "to", "was", "we", "were", "will", "with", "you", "your",
]);

type SearchDocument = {
  videoId: string;
  segmentIndex: number;
  start: number;
  field: "metadata" | "transcript";
  text: string;
  length: number;
};

type SerializedSearchIndex = {
  version: number;
  generatedAt: string;
  algorithm: "BM25";
  documentCount: number;
  averageDocumentLength: number;
  documents: SearchDocument[];
  postings: Record<string, [number, number][]>;
};

const searchIndex = searchIndexData as unknown as SerializedSearchIndex;

export type SearchHit = {
  transcript: TranscriptRecord;
  score?: number;
  matchedTerms?: string[];
  match?: {
    start: number;
    text: string;
  };
};

export function tokenizeSearchQuery(value: string) {
  return Array.from(
    new Set(
      (value.toLocaleLowerCase().match(/[a-z0-9]+(?:'[a-z0-9]+)?/g) ?? [])
        .filter((token) => token.length > 1 && !STOP_WORDS.has(token)),
    ),
  );
}

export function searchTranscripts(
  transcripts: TranscriptRecord[],
  rawQuery: string,
): SearchHit[] {
  const query = rawQuery.trim().toLocaleLowerCase();
  if (!query) return transcripts.map((transcript) => ({ transcript }));

  const queryTerms = tokenizeSearchQuery(query);
  if (!queryTerms.length) return [];

  const transcriptById = new Map(
    transcripts.map((transcript) => [transcript.videoId, transcript]),
  );
  const scores = new Map<string, number>();
  const matchedTerms = new Map<string, Set<string>>();
  const bestDocument = new Map<string, { score: number; document: SearchDocument }>();
  const documentCount = Math.max(1, searchIndex.documentCount);
  const averageLength = Math.max(1, searchIndex.averageDocumentLength);
  const k1 = 1.2;
  const b = 0.75;

  for (const term of queryTerms) {
    const postings = searchIndex.postings[term] ?? [];
    if (!postings.length) continue;
    const documentFrequency = postings.length;
    const inverseDocumentFrequency = Math.log(
      1 + (documentCount - documentFrequency + 0.5) / (documentFrequency + 0.5),
    );

    for (const [documentIndex, termFrequency] of postings) {
      const document = searchIndex.documents[documentIndex];
      if (!document || !transcriptById.has(document.videoId)) continue;
      const lengthNormalization =
        termFrequency +
        k1 * (1 - b + b * (document.length / averageLength));
      const fieldWeight = document.field === "metadata" ? 2.4 : 1;
      let contribution =
        inverseDocumentFrequency *
        ((termFrequency * (k1 + 1)) / lengthNormalization) *
        fieldWeight;
      if (document.text.toLocaleLowerCase().includes(query)) {
        contribution *= 1.7;
      }

      scores.set(
        document.videoId,
        (scores.get(document.videoId) ?? 0) + contribution,
      );
      const terms = matchedTerms.get(document.videoId) ?? new Set<string>();
      terms.add(term);
      matchedTerms.set(document.videoId, terms);

      if (document.field === "transcript") {
        const current = bestDocument.get(document.videoId);
        if (!current || contribution > current.score) {
          bestDocument.set(document.videoId, { score: contribution, document });
        }
      }
    }
  }

  return Array.from(scores.entries())
    .flatMap<SearchHit>(([videoId, rawScore]) => {
      const transcript = transcriptById.get(videoId);
      if (!transcript) return [];
      const terms = Array.from(matchedTerms.get(videoId) ?? []);
      const coverage = terms.length / queryTerms.length;
      const best = bestDocument.get(videoId)?.document;
      return [
        {
          transcript,
          score: Number((rawScore * (0.65 + coverage * 0.35)).toFixed(6)),
          matchedTerms: terms,
          match: best ? { start: best.start, text: best.text } : undefined,
        },
      ];
    })
    .sort(
      (left, right) =>
        (right.score ?? 0) - (left.score ?? 0) ||
        right.transcript.ingestedAt.localeCompare(left.transcript.ingestedAt),
    );
}

export function excerpt(text: string, query: string, limit = 220) {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= limit) return normalized;
  const lowered = normalized.toLocaleLowerCase();
  const exactIndex = lowered.indexOf(query.toLocaleLowerCase());
  const tokenIndex = tokenizeSearchQuery(query)
    .map((token) => lowered.indexOf(token))
    .filter((index) => index >= 0)
    .sort((left, right) => left - right)[0];
  const index = exactIndex >= 0 ? exactIndex : (tokenIndex ?? 0);
  const start = Math.max(0, index - Math.floor(limit / 3));
  const end = Math.min(normalized.length, start + limit);
  return `${start ? "…" : ""}${normalized.slice(start, end).trim()}${end < normalized.length ? "…" : ""}`;
}
