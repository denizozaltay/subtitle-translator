import { ParsedSubtitle, SubtitleEntry } from "../types/subtitle";

export function parseSrtFile(content: string): ParsedSubtitle {
  const blocks = content.trim().split(/\n\n+/);
  const entries: SubtitleEntry[] = [];

  for (const block of blocks) {
    const lines = block.split("\n");
    if (lines.length < 3) continue;

    const index = parseInt(lines[0], 10);
    if (isNaN(index)) continue;

    const timeLine = lines[1];
    const timeMatch = timeLine.match(
      /(\d{2}:\d{2}:\d{2},\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2},\d{3})/
    );
    if (!timeMatch) continue;

    const text = lines.slice(2).join("\n");

    entries.push({
      index,
      startTime: timeMatch[1],
      endTime: timeMatch[2],
      text,
    });
  }

  return {
    format: "srt",
    entries,
    metadata: [],
  };
}

export function rebuildSrtFile(parsed: ParsedSubtitle): string {
  return parsed.entries
    .map((entry) => {
      let text = entry.translatedText ?? entry.text;
      text = text.replace(/\\N/g, "\n");
      return `${entry.index}\n${entry.startTime} --> ${entry.endTime}\n${text}`;
    })
    .join("\n\n");
}
