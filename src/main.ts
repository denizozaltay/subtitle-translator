import {
  parseAssFile,
  rebuildAssFile,
  extractTextsForTranslation,
} from "./parser";
import { translateBatch } from "./translator";
import { readFile, writeFile, fileExists } from "./utils";
import { config } from "./config";

async function main(): Promise<void> {
  console.log(`Input: ${config.inputFile}`);
  console.log(`Output: ${config.outputFile}`);
  console.log(`Target Language: ${config.targetLanguage}`);
  console.log("---");

  if (!fileExists(config.inputFile)) {
    console.error(`Input file not found: ${config.inputFile}`);
    process.exit(1);
  }

  const content = readFile(config.inputFile);
  console.log("Parsing ASS file...");

  const parsed = parseAssFile(content);
  console.log(`Found ${parsed.events.dialogues.length} dialogue lines`);

  const texts = extractTextsForTranslation(parsed.events.dialogues);
  console.log("Starting translation...");

  const translatedTexts = await translateBatch(texts, config.targetLanguage);

  for (let i = 0; i < parsed.events.dialogues.length; i++) {
    parsed.events.dialogues[i].translatedText = translatedTexts[i];
  }

  const output = rebuildAssFile(parsed);
  writeFile(config.outputFile, output);

  console.log("---");
  console.log(`Translation complete! Output saved to: ${config.outputFile}`);
}

main().catch((error) => {
  console.error("Error:", error.message);
  process.exit(1);
});
