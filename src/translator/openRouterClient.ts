import axios from "axios";
import { config } from "../config";

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
    },
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    }
  );

  return response.data.choices[0].message.content.trim();
}

async function translateSingleWithContext(
  text: string,
  targetLanguage: string,
  context: TranslationPair[]
): Promise<string> {
  const systemPrompt = buildSystemPromptWithContext(targetLanguage);
  const userPrompt = buildSinglePromptWithContext(text, context);

  return await callApi(systemPrompt, userPrompt);
}

async function translateBatchWithContext(
  texts: string[],
  targetLanguage: string,
  context: TranslationPair[]
): Promise<string[]> {
  const systemPrompt = buildSystemPromptWithContext(targetLanguage);
  const userPrompt = buildBatchPromptWithContext(texts, context);

  const content = await callApi(systemPrompt, userPrompt);
  return parseBatchResponse(content, texts.length);
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

  const content = await callApi(systemPrompt, userPrompt);
  const revisedTranslations = parseBatchResponse(content, pairs.length);

  return pairs.map((pair, i) => ({
    original: pair.original,
    translated: revisedTranslations[i] || pair.translated,
  }));
}

function buildRevisionSystemPrompt(targetLanguage: string): string {
  return `You are a professional anime subtitle translator and editor. Review and revise translations to ${targetLanguage}.

Your task:
- Review each translation for accuracy, naturalness, and consistency
- Fix any awkward phrasing, mistranslations, or inconsistencies
- Ensure the tone matches anime dialogue style
- Preserve formatting codes: \\N (line break), {\\i1}, {\\i0}, {\\pos(x,y)}, and other ASS style tags
- Keep character names unchanged
- If a translation is already good, keep it as is

Output format:
- Return ONLY the revised translations, one per line
- Each output line corresponds to the input line with the same number
- Do not include line numbers, explanations, or any extra text`;
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
  return `You are a professional anime subtitle translator. Translate subtitle lines to ${targetLanguage}.

Rules:
- Translate naturally and fluently, maintaining consistency with previous translations
- Preserve formatting codes: \\N (line break), {\\i1}, {\\i0}, {\\pos(x,y)}, and other ASS style tags
- Keep character names unchanged unless they have official localized versions
- Maintain the emotional tone and context of anime dialogue
- If a line contains only formatting codes or is empty, return it unchanged
- Use the provided context to maintain translation consistency (same terms, style, tone)`;
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

  return `Previous translations for context:\n${contextStr}\n\nNow translate this line (return ONLY the translation, no explanations):\n${text}`;
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

  return `Previous translations for context:\n${contextStr}\n\nNow translate these ${texts.length} lines. Return ONLY the translations, one per line, no line numbers:\n\n${numbered}`;
}

function parseBatchResponse(content: string, expectedCount: number): string[] {
  const lines = content.split("\n").filter((line) => line.trim() !== "");
  const results: string[] = [];

  for (const line of lines) {
    const cleaned = line.replace(/^\d+\.\s*/, "").trim();
    if (cleaned) {
      results.push(cleaned);
    }
  }

  while (results.length < expectedCount) {
    results.push("");
  }

  return results.slice(0, expectedCount);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
