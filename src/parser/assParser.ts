import { DialogueLine, ParsedSubtitle } from "../types/subtitle";

export function parseAssFile(content: string): ParsedSubtitle {
  const lines = content.split("\n");
  const scriptInfo: string[] = [];
  const styles: string[] = [];
  const dialogues: DialogueLine[] = [];
  const otherLines: string[] = [];
  let formatLine = "";
  let currentSection = "";

  for (const line of lines) {
    const trimmedLine = line.trim();

    if (trimmedLine.startsWith("[Script Info]")) {
      currentSection = "scriptInfo";
      scriptInfo.push(line);
      continue;
    }

    if (
      trimmedLine.startsWith("[V4+ Styles]") ||
      trimmedLine.startsWith("[V4 Styles]")
    ) {
      currentSection = "styles";
      styles.push(line);
      continue;
    }

    if (trimmedLine.startsWith("[Events]")) {
      currentSection = "events";
      otherLines.push(line);
      continue;
    }

    switch (currentSection) {
      case "scriptInfo":
        scriptInfo.push(line);
        break;
      case "styles":
        styles.push(line);
        break;
      case "events":
        if (trimmedLine.startsWith("Format:")) {
          formatLine = line;
        } else if (trimmedLine.startsWith("Dialogue:")) {
          const dialogue = parseDialogueLine(line);
          if (dialogue) {
            dialogues.push(dialogue);
          }
        } else {
          otherLines.push(line);
        }
        break;
    }
  }

  return {
    scriptInfo,
    styles,
    events: {
      formatLine,
      dialogues,
      otherLines,
    },
  };
}

function parseDialogueLine(line: string): DialogueLine | null {
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

  const layer = parts[0];
  const start = parts[1];
  const end = parts[2];
  const style = parts[3];
  const name = parts[4];
  const marginL = parts[5];
  const marginR = parts[6];
  const marginV = parts[7];
  const effect = parts[8];
  const text = parts.slice(9).join(",");

  return {
    rawLine: line,
    layer,
    start,
    end,
    style,
    name,
    marginL,
    marginR,
    marginV,
    effect,
    text,
  };
}

export function rebuildAssFile(parsed: ParsedSubtitle): string {
  const lines: string[] = [];

  lines.push(...parsed.scriptInfo);
  lines.push(...parsed.styles);
  lines.push("[Events]");
  lines.push(parsed.events.formatLine);

  for (const dialogue of parsed.events.dialogues) {
    const text = dialogue.translatedText ?? dialogue.text;
    const rebuiltLine = `Dialogue: ${dialogue.layer},${dialogue.start},${dialogue.end},${dialogue.style},${dialogue.name},${dialogue.marginL},${dialogue.marginR},${dialogue.marginV},${dialogue.effect},${text}`;
    lines.push(rebuiltLine);
  }

  for (const otherLine of parsed.events.otherLines) {
    if (!otherLine.trim().startsWith("[Events]")) {
      lines.push(otherLine);
    }
  }

  return lines.join("\n");
}

export function extractTextsForTranslation(
  dialogues: DialogueLine[]
): string[] {
  return dialogues.map((d) => d.text);
}
