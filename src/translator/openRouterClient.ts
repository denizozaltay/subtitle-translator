import axios from "axios";

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = "google/gemini-3-flash-preview";
const BATCH_SIZE = 5;

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

async function translateChunk(
  texts: string[],
  targetLanguage: string
): Promise<string[]> {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not set in environment variables");
  }

  const systemPrompt = buildSystemPrompt(targetLanguage);
  const userPrompt = buildBatchUserPrompt(texts);

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

  const content = response.data.choices[0].message.content.trim();
  return parseBatchResponse(content, texts.length);
}

export async function translateBatch(
  texts: string[],
  targetLanguage: string
): Promise<string[]> {
  const results: string[] = [];
  const totalBatches = Math.ceil(texts.length / BATCH_SIZE);

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const chunk = texts.slice(i, i + BATCH_SIZE);
    const batchNumber = Math.floor(i / BATCH_SIZE) + 1;

    console.log(
      `Translating batch ${batchNumber}/${totalBatches} (lines ${
        i + 1
      }-${Math.min(i + BATCH_SIZE, texts.length)})`
    );

    const translatedChunk = await translateChunk(chunk, targetLanguage);
    results.push(...translatedChunk);

    await delay(300);
  }

  return results;
}

function buildSystemPrompt(targetLanguage: string): string {
  return `You are a professional anime subtitle translator. Translate subtitle lines to ${targetLanguage}.

Rules:
- Translate each line naturally and fluently
- Preserve formatting codes: \\N (line break), {\\i1}, {\\i0}, {\\pos(x,y)}, and other ASS style tags
- Keep character names unchanged unless they have official localized versions
- Maintain the emotional tone and context of anime dialogue
- If a line contains only formatting codes or is empty, return it unchanged

Output format:
- Return ONLY the translations, one per line
- Each output line corresponds to the input line with the same number
- Do not include line numbers, explanations, or any extra text`;
}

function buildBatchUserPrompt(texts: string[]): string {
  const numbered = texts.map((text, i) => `${i + 1}. ${text}`).join("\n");
  return `Translate these ${texts.length} subtitle lines:\n\n${numbered}`;
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
