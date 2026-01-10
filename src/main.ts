import {
  parseSubtitle,
  rebuildSubtitle,
  extractTexts,
  getFormatFromExtension,
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
  const format = getFormatFromExtension(config.inputFile);
  console.log(`Parsing ${format.toUpperCase()} file...`);

  const parsed = parseSubtitle(content, format);
  console.log(`Found ${parsed.entries.length} subtitle entries`);

  const texts = extractTexts(parsed);
  console.log("Starting translation...");

  const translatedTexts = await translateBatch(texts, config.targetLanguage);

  for (let i = 0; i < parsed.entries.length; i++) {
    parsed.entries[i].translatedText = translatedTexts[i];
  }

  const output = rebuildSubtitle(parsed);
  writeFile(config.outputFile, output);

  console.log("---");
  console.log(`Translation complete! Output saved to: ${config.outputFile}`);
}

main().catch((error) => {
  console.error("Error:", error.message);
  process.exit(1);
});
