import axios from "axios";
import { config } from "../config";
import { withRetry, isValidBatchTranslation } from "../utils/retryHandler";

// --- Types ---

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface OpenRouterResponse {
  choices: { message: { content: string } }[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    cost?: number;
  };
}

interface UsageStats {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  totalCost: number;
  apiCalls: number;
}

const usageStats: UsageStats = {
  promptTokens: 0,
  completionTokens: 0,
  totalTokens: 0,
  totalCost: 0,
  apiCalls: 0,
};

interface ContextItem {
  id: number;
  original: string;
  translated: string;
}

interface TranslateItem {
  id: number;
  original: string;
}

interface TranslationOutputItem {
  id: number;
  original: string;
  translated: string;
}

interface TranslationOutput {
  translations: TranslationOutputItem[];
}

// --- JSON Schema (tek şema, tüm çağrılarda ortak) ---

const TRANSLATION_SCHEMA = {
  name: "translation_response",
  strict: true,
  schema: {
    type: "object",
    properties: {
      translations: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: {
              type: "integer",
              description: "Line ID, must match the input id exactly",
            },
            original: {
              type: "string",
              description:
                "Original text, must be copied from the input exactly as-is",
            },
            translated: {
              type: "string",
              description: "Translated subtitle text",
            },
          },
          required: ["id", "original", "translated"],
          additionalProperties: false,
        },
      },
    },
    required: ["translations"],
    additionalProperties: false,
  },
};

// --- API ---

async function callApi(
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not set in environment variables");
  }

  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];

  const response = await axios.post<OpenRouterResponse>(
    config.apiUrl,
    {
      model: config.model,
      messages,
      reasoning: { enabled: true },
      response_format: {
        type: "json_schema",
        json_schema: TRANSLATION_SCHEMA,
      },
    },
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://github.com/denizozaltay/subtitle-translator",
        "X-Title": "Subtitle Translator",
      },
    }
  );

  if (response.data.usage) {
    usageStats.promptTokens += response.data.usage.prompt_tokens;
    usageStats.completionTokens += response.data.usage.completion_tokens;
    usageStats.totalTokens += response.data.usage.total_tokens;
    usageStats.totalCost += response.data.usage.cost ?? 0;
  }
  usageStats.apiCalls++;

  return response.data.choices[0].message.content.trim();
}

// --- Validation ---

function validateAndExtract(
  expectedItems: TranslateItem[],
  content: string
): string[] {
  const parsed: TranslationOutput = JSON.parse(content);
  const output = parsed.translations;

  if (output.length !== expectedItems.length) {
    throw new Error(
      `Count mismatch: expected ${expectedItems.length} translations, got ${output.length}`
    );
  }

  const translations: string[] = [];

  for (let i = 0; i < expectedItems.length; i++) {
    const expected = expectedItems[i];
    const received = output[i];

    if (received.id !== expected.id) {
      throw new Error(
        `ID mismatch at index ${i}: expected ${expected.id}, got ${received.id}`
      );
    }

    if (normalize(received.original) !== normalize(expected.original)) {
      console.warn(
        `  ⚠ Original text mismatch for id ${expected.id}:\n` +
          `    Expected: "${expected.original}"\n` +
          `    Got:      "${received.original}"`
      );
    }

    translations.push(restoreAssLineBreaks(received.translated));
  }

  return translations;
}

function normalize(text: string): string {
  return text
    .replace(/\\N/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function restoreAssLineBreaks(text: string): string {
  return text.replace(/\n/g, "\\N");
}

// --- Core Translation Functions ---

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

// --- Main Export ---

export async function translateBatch(
  texts: string[],
  targetLanguage: string
): Promise<string[]> {
  const results: string[] = [];
  const contextPairs: ContextItem[] = [];

  // Phase 1: Warmup — tek tek çeviri, büyüyen context ile
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

  // Phase 2: Revision — warmup çevirilerini gözden geçir
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

  // Phase 3: Batch — kalan satırları toplu çevir
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

// --- Prompt Builders ---

function buildTranslationSystemPrompt(targetLanguage: string): string {
  return `You are a professional subtitle translator. Translate subtitle lines to ${targetLanguage}.

Rules:
- Translate naturally and fluently, maintaining consistency with previous translations
- Preserve formatting codes: \\N (line break), {\\i1}, {\\i0}, {\\pos(x,y)}, and other ASS style tags
- Keep character names unchanged unless they have official localized versions
- Maintain the emotional tone and context of subtitle dialogue
- If a line contains only formatting codes or is empty, return it unchanged
- Use the provided context to maintain translation consistency (same terms, style, tone)

You will receive a JSON object with:
- "context": previously translated lines for reference
- "to_translate": lines that need translation

Respond with a JSON object containing a "translations" array. Each item must include the exact "id" and "original" from the input, plus the "translated" text.`;
}

function buildRevisionSystemPrompt(targetLanguage: string): string {
  return `You are a professional subtitle translator and editor. Review and revise translations to ${targetLanguage}.

Your task:
- Review each translation for accuracy, naturalness, and consistency
- Fix any awkward phrasing, mistranslations, or inconsistencies
- Ensure the tone matches subtitle dialogue style
- Preserve formatting codes: \\N (line break), {\\i1}, {\\i0}, {\\pos(x,y)}, and other ASS style tags
- Keep character names unchanged
- If a translation is already good, keep it as is

You will receive a JSON object with "to_revise" containing lines with their current translations.

Respond with a JSON object containing a "translations" array. Each item must include the exact "id" and "original" from the input, plus the revised "translated" text.`;
}

function printUsageSummary(): void {
  console.log("\n=== Token Usage Summary ===");
  console.log(`  API Calls:        ${usageStats.apiCalls}`);
  console.log(`  Input Tokens:     ${usageStats.promptTokens.toLocaleString()}`);
  console.log(`  Output Tokens:    ${usageStats.completionTokens.toLocaleString()}`);
  console.log(`  Total Tokens:     ${usageStats.totalTokens.toLocaleString()}`);
  console.log(`  Total Cost:       $${usageStats.totalCost.toFixed(6)}`);
  console.log("===========================");
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
