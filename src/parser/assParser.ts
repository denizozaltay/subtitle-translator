import { ParsedSubtitle, SubtitleEntry } from "../types/subtitle";

export function parseAssFile(content: string): ParsedSubtitle {
  const lines = content.split("\n");
  const metadata: string[] = [];
  const entries: SubtitleEntry[] = [];
  let currentSection = "";
  let entryIndex = 0;

  for (const line of lines) {
    const trimmedLine = line.trim();

    if (trimmedLine.startsWith("[Script Info]")) {
      currentSection = "scriptInfo";
      metadata.push(line);
      continue;
    }

    if (
      trimmedLine.startsWith("[V4+ Styles]") ||
      trimmedLine.startsWith("[V4 Styles]")
    ) {
      currentSection = "styles";
      metadata.push(line);
      continue;
    }

    if (trimmedLine.startsWith("[Events]")) {
      currentSection = "events";
      metadata.push(line);
      continue;
    }

    if (currentSection === "events") {
      if (trimmedLine.startsWith("Format:")) {
        metadata.push(line);
      } else if (trimmedLine.startsWith("Dialogue:")) {
        const entry = parseDialogueLine(line, entryIndex++);
        if (entry) {
          entries.push(entry);
        }
      } else {
        metadata.push(line);
      }
    } else {
      metadata.push(line);
    }
  }

  return {
    format: "ass",
    entries,
    metadata,
  };
}

function parseDialogueLine(line: string, index: number): SubtitleEntry | null {
  const dialoguePrefix = "Dialogue:";
  if (!line.trim().startsWith(dialoguePrefix)) {
    return null;
  }

  const content = line
    .substring(line.indexOf(dialoguePrefix) + dialoguePrefix.length)
    .trim();
  const parts = content.split(",");

  if (parts.length < 10) {
    return null;
  }

  return {
    index,
    startTime: parts[1],
    endTime: parts[2],
    text: parts.slice(9).join(","),
    rawData: {
      layer: parts[0],
      style: parts[3],
      name: parts[4],
      marginL: parts[5],
      marginR: parts[6],
      marginV: parts[7],
      effect: parts[8],
    },
  };
}

export function rebuildAssFile(parsed: ParsedSubtitle): string {
  const lines: string[] = [];
  let entryIndex = 0;

  for (const line of parsed.metadata) {
    lines.push(line);

    if (line.trim().startsWith("Format:") && line.includes("Text")) {
      for (const entry of parsed.entries) {
        const raw = entry.rawData!;
        const text = entry.translatedText ?? entry.text;
        const rebuiltLine = `Dialogue: ${raw.layer},${entry.startTime},${entry.endTime},${raw.style},${raw.name},${raw.marginL},${raw.marginR},${raw.marginV},${raw.effect},${text}`;
        lines.push(rebuiltLine);
        entryIndex++;
      }
    }
  }

  return lines.join("\n");
}
