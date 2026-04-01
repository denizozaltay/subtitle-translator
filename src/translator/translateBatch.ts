import { config } from "../config";
import { withRetry, isValidBatchTranslation } from "../utils/retryHandler";
import { ContextItem, TranslateItem } from "../types";
import { callApi, printUsageSummary } from "./api";
import { validateAndExtract } from "./validation";
import {
  buildTranslationSystemPrompt,
  buildRevisionSystemPrompt,
} from "./prompts";

async function translateItems(
  items: TranslateItem[],
  context: ContextItem[],
  targetLanguage: string
): Promise<string[]> {
  const systemPrompt = buildTranslationSystemPrompt(targetLanguage);
  const userPrompt = JSON.stringify(
    { context, to_translate: items },
    null,
    2
  );

  return await withRetry(
    async () => {
      const content = await callApi(systemPrompt, userPrompt);
      return validateAndExtract(items, content);
    },
    (result) => isValidBatchTranslation(result, items.length),
    {
      maxRetries: config.maxRetries,
      baseDelayMs: config.retryBaseDelayMs,
      maxDelayMs: config.retryMaxDelayMs,
    }
  );
}

async function reviseItems(
  items: ContextItem[],
  targetLanguage: string
): Promise<string[]> {
  const systemPrompt = buildRevisionSystemPrompt(targetLanguage);
  const userPrompt = JSON.stringify(
    {
      to_revise: items.map((item) => ({
        id: item.id,
        original: item.original,
        current_translation: item.translated,
      })),
    },
    null,
    2
  );

  const expectedItems: TranslateItem[] = items.map(({ id, original }) => ({
    id,
    original,
  }));

  return await withRetry(
    async () => {
      const content = await callApi(systemPrompt, userPrompt);
      return validateAndExtract(expectedItems, content);
    },
    (result) => isValidBatchTranslation(result, items.length),
    {
      maxRetries: config.maxRetries,
      baseDelayMs: config.retryBaseDelayMs,
      maxDelayMs: config.retryMaxDelayMs,
    }
  );
}

export async function translateBatch(
  texts: string[],
  targetLanguage: string
): Promise<string[]> {
  const results: string[] = [];
  const contextPairs: ContextItem[] = [];

  const warmupCount = Math.min(config.warmupCount, texts.length);
  console.log(
    `Phase 1: Warming up with first ${warmupCount} lines (one by one with growing context)`
  );

  for (let i = 0; i < warmupCount; i++) {
    const id = i + 1;
    const text = texts[i];
    console.log(
      `  Translating ${id}/${warmupCount}: ${text.substring(0, 40)}...`
    );

    const [translated] = await translateItems(
      [{ id, original: text }],
      contextPairs,
      targetLanguage
    );

    results.push(translated);
    contextPairs.push({ id, original: text, translated });
    await delay(config.delayMs);
  }

  if (results.length > 0) {
    console.log("\nPhase 2: Reviewing and revising warmup translations...");
    const revisedTranslations = await reviseItems(contextPairs, targetLanguage);

    for (let i = 0; i < revisedTranslations.length; i++) {
      results[i] = revisedTranslations[i];
      contextPairs[i].translated = revisedTranslations[i];
    }
  }

  if (texts.length <= warmupCount) {
    printUsageSummary();
    return results;
  }

  const remainingTexts = texts.slice(warmupCount);
  const totalBatches = Math.ceil(remainingTexts.length / config.batchSize);

  console.log(
    `\nPhase 3: Batch translating remaining ${remainingTexts.length} lines (${config.batchSize} at a time)`
  );

  for (let i = 0; i < remainingTexts.length; i += config.batchSize) {
    const chunk = remainingTexts.slice(i, i + config.batchSize);
    const batchNumber = Math.floor(i / config.batchSize) + 1;
    const globalStartIdx = warmupCount + i;

    console.log(
      `  Batch ${batchNumber}/${totalBatches} (lines ${globalStartIdx + 1}-${globalStartIdx + chunk.length})`
    );

    const items: TranslateItem[] = chunk.map((text, j) => ({
      id: globalStartIdx + j + 1,
      original: text,
    }));

    const contextWindow = contextPairs.slice(-config.batchSize);
    const translatedChunk = await translateItems(
      items,
      contextWindow,
      targetLanguage
    );

    for (let j = 0; j < chunk.length; j++) {
      results.push(translatedChunk[j]);
      contextPairs.push({
        id: globalStartIdx + j + 1,
        original: chunk[j],
        translated: translatedChunk[j],
      });
    }

    await delay(config.delayMs);
  }

  printUsageSummary();
  return results;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
