import axios from "axios";
import { config } from "../config";
import {
  withRetry,
  isValidTranslation,
  isValidBatchTranslation,
} from "../utils/retryHandler";

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
  reasoning_details?: unknown;
}

interface OpenRouterResponse {
  choices: {
    message: {
      content: string;
      reasoning_details?: unknown;
    };
  }[];
}

interface TranslationPair {
  original: string;
  translated: string;
}

interface JsonSchema {
  name: string;
  strict: boolean;
  schema: Record<string, unknown>;
}

interface SingleTranslationOutput {
  translation: string;
}

interface BatchTranslationOutput {
  translations: string[];
}

const SINGLE_TRANSLATION_SCHEMA: JsonSchema = {
  name: "single_translation",
  strict: true,
  schema: {
    type: "object",
    properties: {
      translation: {
        type: "string",
        description: "The translated subtitle line",
      },
    },
    required: ["translation"],
    additionalProperties: false,
  },
};

function createBatchTranslationSchema(count: number): JsonSchema {
  return {
    name: "batch_translation",
    strict: true,
    schema: {
      type: "object",
      properties: {
        translations: {
          type: "array",
          items: { type: "string" },
          description: `Array of exactly ${count} translated subtitle lines, in the same order as the input`,
        },
      },
      required: ["translations"],
      additionalProperties: false,
    },
  };
}

async function callApi(
  systemPrompt: string,
  userPrompt: string,
  jsonSchema: JsonSchema
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
        json_schema: jsonSchema,
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

  return response.data.choices[0].message.content.trim();
}

function parseSingleResponse(content: string): string {
  const parsed: SingleTranslationOutput = JSON.parse(content);
  return parsed.translation;
}

function parseBatchJsonResponse(
  content: string,
  expectedCount: number
): string[] {
  const parsed: BatchTranslationOutput = JSON.parse(content);
  const results = parsed.translations;

  while (results.length < expectedCount) {
    results.push("");
  }

  return results.slice(0, expectedCount);
}

async function translateSingleWithContext(
  text: string,
  targetLanguage: string,
  context: TranslationPair[]
): Promise<string> {
  const systemPrompt = buildSystemPromptWithContext(targetLanguage);
  const userPrompt = buildSinglePromptWithContext(text, context);

  return await withRetry(
    async () => {
      const content = await callApi(
        systemPrompt,
        userPrompt,
        SINGLE_TRANSLATION_SCHEMA
      );
      return parseSingleResponse(content);
    },
    isValidTranslation,
    {
      maxRetries: config.maxRetries,
      baseDelayMs: config.retryBaseDelayMs,
      maxDelayMs: config.retryMaxDelayMs,
    }
  );
}

async function translateBatchWithContext(
  texts: string[],
  targetLanguage: string,
  context: TranslationPair[]
): Promise<string[]> {
  const systemPrompt = buildSystemPromptWithContext(targetLanguage);
  const userPrompt = buildBatchPromptWithContext(texts, context);
  const schema = createBatchTranslationSchema(texts.length);

  return await withRetry(
    async () => {
      const content = await callApi(systemPrompt, userPrompt, schema);
      return parseBatchJsonResponse(content, texts.length);
    },
    (result) => isValidBatchTranslation(result, texts.length),
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
  const translationPairs: TranslationPair[] = [];

  console.log(
    `Phase 1: Warming up with first ${Math.min(
      config.warmupCount,
      texts.length
    )} lines (one by one with growing context)`
  );

  for (let i = 0; i < Math.min(config.warmupCount, texts.length); i++) {
    const text = texts[i];
    console.log(
      `  Translating ${i + 1}/${config.warmupCount}: ${text.substring(
        0,
        40
      )}...`
    );

    const translated = await translateSingleWithContext(
      text,
      targetLanguage,
      translationPairs
    );
    results.push(translated);
    translationPairs.push({ original: text, translated });

    await delay(config.delayMs);
  }

  if (results.length > 0) {
    console.log("\nPhase 2: Reviewing and revising warmup translations...");
    const revisedPairs = await reviseWarmupTranslations(
      translationPairs,
      targetLanguage
    );

    for (let i = 0; i < revisedPairs.length; i++) {
      results[i] = revisedPairs[i].translated;
      translationPairs[i] = revisedPairs[i];
    }
  }

  if (texts.length <= config.warmupCount) {
    return results;
  }

  console.log(
    `\nPhase 3: Batch translating remaining ${
      texts.length - config.warmupCount
    } lines (${config.batchSize} at a time with previous ${
      config.batchSize
    } as context)`
  );

  const remainingTexts = texts.slice(config.warmupCount);
  const totalBatches = Math.ceil(remainingTexts.length / config.batchSize);

  for (let i = 0; i < remainingTexts.length; i += config.batchSize) {
    const chunk = remainingTexts.slice(i, i + config.batchSize);
    const batchNumber = Math.floor(i / config.batchSize) + 1;
    const globalStart = config.warmupCount + i + 1;
    const globalEnd = Math.min(
      config.warmupCount + i + config.batchSize,
      texts.length
    );

    console.log(
      `  Batch ${batchNumber}/${totalBatches} (lines ${globalStart}-${globalEnd})`
    );

    const contextWindow = translationPairs.slice(-config.batchSize);
    const translatedChunk = await translateBatchWithContext(
      chunk,
      targetLanguage,
      contextWindow
    );

    for (let j = 0; j < chunk.length; j++) {
      results.push(translatedChunk[j]);
      translationPairs.push({
        original: chunk[j],
        translated: translatedChunk[j],
      });
    }

    await delay(config.delayMs);
  }

  return results;
}

async function reviseWarmupTranslations(
  pairs: TranslationPair[],
  targetLanguage: string
): Promise<TranslationPair[]> {
  const systemPrompt = buildRevisionSystemPrompt(targetLanguage);
  const userPrompt = buildRevisionUserPrompt(pairs);
  const schema = createBatchTranslationSchema(pairs.length);

  const revisedTranslations = await withRetry(
    async () => {
      const content = await callApi(systemPrompt, userPrompt, schema);
      return parseBatchJsonResponse(content, pairs.length);
    },
    (result) => isValidBatchTranslation(result, pairs.length),
    {
      maxRetries: config.maxRetries,
      baseDelayMs: config.retryBaseDelayMs,
      maxDelayMs: config.retryMaxDelayMs,
    }
  );

  return pairs.map((pair, i) => ({
    original: pair.original,
    translated: revisedTranslations[i] || pair.translated,
  }));
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

Respond with a JSON object containing a "translations" array with the revised translations in order.`;
}

function buildRevisionUserPrompt(pairs: TranslationPair[]): string {
  const pairsStr = pairs
    .map(
      (pair, i) =>
        `${i + 1}. Original: ${pair.original}\n   Translation: ${
          pair.translated
        }`
    )
    .join("\n\n");

  return `Review these ${pairs.length} translations. If any need improvement, fix them. Return the final version of each translation:\n\n${pairsStr}`;
}

function buildSystemPromptWithContext(targetLanguage: string): string {
  return `You are a professional subtitle translator. Translate subtitle lines to ${targetLanguage}.

Rules:
- Translate naturally and fluently, maintaining consistency with previous translations
- Preserve formatting codes: \\N (line break), {\\i1}, {\\i0}, {\\pos(x,y)}, and other ASS style tags
- Keep character names unchanged unless they have official localized versions
- Maintain the emotional tone and context of subtitle dialogue
- If a line contains only formatting codes or is empty, return it unchanged
- Use the provided context to maintain translation consistency (same terms, style, tone)

Respond with a JSON object as specified by the schema.`;
}

function buildSinglePromptWithContext(
  text: string,
  context: TranslationPair[]
): string {
  if (context.length === 0) {
    return `Translate this subtitle line:\n${text}`;
  }

  const contextStr = context
    .map(
      (pair) => `Original: ${pair.original}\nTranslation: ${pair.translated}`
    )
    .join("\n\n");

  return `Previous translations for context:\n${contextStr}\n\nNow translate this line:\n${text}`;
}

function buildBatchPromptWithContext(
  texts: string[],
  context: TranslationPair[]
): string {
  const contextStr = context
    .map(
      (pair) => `Original: ${pair.original}\nTranslation: ${pair.translated}`
    )
    .join("\n\n");

  const numbered = texts.map((text, i) => `${i + 1}. ${text}`).join("\n");

  return `Previous translations for context:\n${contextStr}\n\nTranslate these ${texts.length} lines. Return them in the same order:\n\n${numbered}`;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
