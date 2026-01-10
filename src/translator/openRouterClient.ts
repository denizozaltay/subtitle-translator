import axios from "axios";

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = "google/gemini-3-flash-preview";
const WARMUP_COUNT = 10;
const BATCH_SIZE = 10;

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
    OPENROUTER_API_URL,
    {
      model: MODEL,
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
      WARMUP_COUNT,
      texts.length
    )} lines (one by one with growing context)`
  );

  for (let i = 0; i < Math.min(WARMUP_COUNT, texts.length); i++) {
    const text = texts[i];
    console.log(
      `  Translating ${i + 1}/${WARMUP_COUNT}: ${text.substring(0, 40)}...`
    );

    const translated = await translateSingleWithContext(
      text,
      targetLanguage,
      translationPairs
    );
    results.push(translated);
    translationPairs.push({ original: text, translated });

    await delay(300);
  }

  if (texts.length <= WARMUP_COUNT) {
    return results;
  }

  console.log(
    `\nPhase 2: Batch translating remaining ${
      texts.length - WARMUP_COUNT
    } lines (${BATCH_SIZE} at a time with previous ${BATCH_SIZE} as context)`
  );

  const remainingTexts = texts.slice(WARMUP_COUNT);
  const totalBatches = Math.ceil(remainingTexts.length / BATCH_SIZE);

  for (let i = 0; i < remainingTexts.length; i += BATCH_SIZE) {
    const chunk = remainingTexts.slice(i, i + BATCH_SIZE);
    const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
    const globalStart = WARMUP_COUNT + i + 1;
    const globalEnd = Math.min(WARMUP_COUNT + i + BATCH_SIZE, texts.length);

    console.log(
      `  Batch ${batchNumber}/${totalBatches} (lines ${globalStart}-${globalEnd})`
    );

    const contextWindow = translationPairs.slice(-BATCH_SIZE);
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

    await delay(300);
  }

  return results;
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
