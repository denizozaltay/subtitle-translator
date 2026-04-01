import axios from "axios";
import { config } from "../config";
import { TRANSLATION_SCHEMA } from "./schema";

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

export async function callApi(
  systemPrompt: string,
  userPrompt: string
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

export function printUsageSummary(): void {
  console.log("\n=== Token Usage Summary ===");
  console.log(`  API Calls:        ${usageStats.apiCalls}`);
  console.log(`  Input Tokens:     ${usageStats.promptTokens.toLocaleString()}`);
  console.log(`  Output Tokens:    ${usageStats.completionTokens.toLocaleString()}`);
  console.log(`  Total Tokens:     ${usageStats.totalTokens.toLocaleString()}`);
  console.log(`  Total Cost:       $${usageStats.totalCost.toFixed(6)}`);
  console.log("===========================");
}
