import axios from "axios";
import { config } from "../config";
import { withRetry, isValidBatchTranslation } from "../utils/retryHandler";
import {
  TranslationContext,
  TranslationRequest,
  TranslationResponse,
} from "../types/subtitle";

interface OpenRouterResponse {
  choices: {
    message: {
      content: string;
    };
  }[];
}

async function callApi(
  systemPrompt: string,
  userPrompt: string,
): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not set in environment variables");
  }

  const response = await axios.post<OpenRouterResponse>(
    config.apiUrl,
    {
      model: config.model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      reasoning: { enabled: true },
      response_format: { type: "json_object" },
    },
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://github.com/denizozaltay/subtitle-translator",
        "X-Title": "Subtitle Translator",
      },
    },
  );

  return response.data.choices[0].message.content.trim();
}

function buildSystemPrompt(targetLanguage: string): string {
  return `You are a professional subtitle translator. Translate subtitle lines to ${targetLanguage}.

Rules:
- Translate naturally and fluently, maintaining consistency with previous translations
- Preserve formatting codes: \\N (line break), {\\i1}, {\\i0}, {\\pos(x,y)}, and other ASS style tags
- Keep character names unchanged unless they have official localized versions
- Maintain the emotional tone and context of subtitle dialogue
- If a line contains only formatting codes or is empty, return it unchanged
- Use the provided context to maintain translation consistency (same terms, style, tone)

You will receive a JSON object with "context" (previous translations) and "sentences" (lines to translate).
Respond with a JSON object in this exact format:
{
  "translations": [
    { "id": 1, "text": "translated text here" },
    { "id": 2, "text": "translated text here" }
  ]
}

Return ONLY valid JSON. No explanations, no extra text.`;
}

function buildUserPrompt(
  texts: string[],
  context: TranslationContext[],
): string {
  const request: TranslationRequest = {
    context,
    sentences: texts.map((text, i) => ({ id: i + 1, text })),
  };

  return JSON.stringify(request);
}

function parseJsonResponse(content: string, expectedCount: number): string[] {
  const parsed: TranslationResponse = JSON.parse(content);

  if (!parsed.translations || !Array.isArray(parsed.translations)) {
    throw new Error("Response missing 'translations' array");
  }

  const sorted = [...parsed.translations].sort((a, b) => a.id - b.id);

  return sorted.map((item) => item.text).slice(0, expectedCount);
}

async function translateChunk(
  texts: string[],
  targetLanguage: string,
  context: TranslationContext[],
): Promise<string[]> {
  const systemPrompt = buildSystemPrompt(targetLanguage);
  const userPrompt = buildUserPrompt(texts, context);

  return await withRetry(
    async () => {
      const content = await callApi(systemPrompt, userPrompt);
      return parseJsonResponse(content, texts.length);
    },
    (result) => isValidBatchTranslation(result, texts.length),
    {
      maxRetries: config.maxRetries,
      baseDelayMs: config.retryBaseDelayMs,
      maxDelayMs: config.retryMaxDelayMs,
    },
  );
}

export async function translateBatch(
  texts: string[],
  targetLanguage: string,
): Promise<string[]> {
  const results: string[] = [];
  const history: TranslationContext[] = [];
  const totalBatches = Math.ceil(texts.length / config.batchSize);

  console.log(
    `Translating ${texts.length} lines (${config.batchSize} per batch, ${totalBatches} batches)`,
  );

  for (let i = 0; i < texts.length; i += config.batchSize) {
    const chunk = texts.slice(i, i + config.batchSize);
    const batchNumber = Math.floor(i / config.batchSize) + 1;

    console.log(
      `  Batch ${batchNumber}/${totalBatches} (lines ${i + 1}-${i + chunk.length})`,
    );

    const context = history.slice(-config.batchSize);
    const translated = await translateChunk(chunk, targetLanguage, context);

    for (let j = 0; j < chunk.length; j++) {
      results.push(translated[j]);
      history.push({ original: chunk[j], translation: translated[j] });
    }

    if (i + config.batchSize < texts.length) {
      await delay(config.delayMs);
    }
  }

  return results;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
