export type SubtitleFormat = "ass" | "srt";

export interface SubtitleEntry {
  index: number;
  startTime: string;
  endTime: string;
  text: string;
  translatedText?: string;
  rawData?: Record<string, string>;
}

export interface ParsedSubtitle {
  format: SubtitleFormat;
  entries: SubtitleEntry[];
  metadata: string[];
}

export interface TranslationResult {
  original: string;
  translated: string;
}
