import {
  parseAssFile,
  rebuildAssFile,
  extractTextsForTranslation,
} from "./parser";
import { translateBatch } from "./translator";
import { readFile, writeFile, fileExists } from "./utils";

const INPUT_FILE = "subtitle.ass";
const OUTPUT_FILE = "subtitle_tr.ass";
const TARGET_LANGUAGE = "Turkish";

async function main(): Promise<void> {
  console.log(`Input: ${INPUT_FILE}`);
  console.log(`Output: ${OUTPUT_FILE}`);
  console.log(`Target Language: ${TARGET_LANGUAGE}`);
  console.log("---");

  if (!fileExists(INPUT_FILE)) {
    console.error(`Input file not found: ${INPUT_FILE}`);
    process.exit(1);
  }

  const content = readFile(INPUT_FILE);
  console.log("Parsing ASS file...");

  const parsed = parseAssFile(content);
  console.log(`Found ${parsed.events.dialogues.length} dialogue lines`);

  const texts = extractTextsForTranslation(parsed.events.dialogues);
  console.log("Starting translation...");

  const translatedTexts = await translateBatch(texts, TARGET_LANGUAGE);

  for (let i = 0; i < parsed.events.dialogues.length; i++) {
    parsed.events.dialogues[i].translatedText = translatedTexts[i];
  }

  const output = rebuildAssFile(parsed);
  writeFile(OUTPUT_FILE, output);

  console.log("---");
  console.log(`Translation complete! Output saved to: ${OUTPUT_FILE}`);
}

main().catch((error) => {
  console.error("Error:", error.message);
  process.exit(1);
});
