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

export interface TranslationContext {
  original: string;
  translation: string;
}

export interface TranslationSentence {
  id: number;
  text: string;
}

export interface TranslationRequest {
  context: TranslationContext[];
  sentences: TranslationSentence[];
}

export interface TranslationResponse {
  translations: TranslationSentence[];
}
