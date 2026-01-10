import { ParsedSubtitle, SubtitleFormat } from "../types/subtitle";
import { parseAssFile, rebuildAssFile } from "./assParser";
import { parseSrtFile, rebuildSrtFile } from "./srtParser";

export function parseSubtitle(
  content: string,
  format: SubtitleFormat
): ParsedSubtitle {
  switch (format) {
    case "ass":
      return parseAssFile(content);
    case "srt":
      return parseSrtFile(content);
  }
}

export function rebuildSubtitle(parsed: ParsedSubtitle): string {
  switch (parsed.format) {
    case "ass":
      return rebuildAssFile(parsed);
    case "srt":
      return rebuildSrtFile(parsed);
  }
}

export function extractTexts(parsed: ParsedSubtitle): string[] {
  return parsed.entries.map((e) => e.text);
}

export function getFormatFromExtension(filename: string): SubtitleFormat {
  const ext = filename.toLowerCase().split(".").pop();
  if (ext === "srt") return "srt";
  return "ass";
}
