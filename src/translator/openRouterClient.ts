import axios from "axios";

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = "google/gemini-3-flash-preview";

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

export async function translateText(
  text: string,
  targetLanguage: string
): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not set in environment variables");
  }

  const systemPrompt = buildSystemPrompt(targetLanguage);
  const userPrompt = buildUserPrompt(text);

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

export async function translateBatch(
  texts: string[],
  targetLanguage: string
): Promise<string[]> {
  const results: string[] = [];

  for (let i = 0; i < texts.length; i++) {
    const text = texts[i];
    console.log(
      `Translating ${i + 1}/${texts.length}: ${text.substring(0, 50)}...`
    );

    const translated = await translateText(text, targetLanguage);
    results.push(translated);

    await delay(500);
  }

  return results;
}

function buildSystemPrompt(targetLanguage: string): string {
  return `You are a professional anime subtitle translator. Your task is to translate subtitle lines to ${targetLanguage}.

Rules:
- Translate naturally and fluently for the target language
- Preserve formatting codes like \\N (line break), {\\i1}, {\\i0}, {\\pos(x,y)}, and other ASS style tags
- Keep character names unchanged unless they have official localized versions
- Maintain the emotional tone and context of anime dialogue
- Do not add explanations or notes, only provide the translation
- If the text contains only formatting codes or is empty, return it unchanged`;
}

function buildUserPrompt(text: string): string {
  return `Translate this subtitle line:\n${text}`;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
