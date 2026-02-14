import { config } from "../config";

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
}

export function createEmptyUsage(): TokenUsage {
  return { inputTokens: 0, outputTokens: 0 };
}

export function addUsage(total: TokenUsage, added: TokenUsage): void {
  total.inputTokens += added.inputTokens;
  total.outputTokens += added.outputTokens;
}

export function calculateCost(
  usage: TokenUsage,
  inputPrice: number,
  outputPrice: number,
): number {
  return (
    (usage.inputTokens * inputPrice + usage.outputTokens * outputPrice) /
    1_000_000
  );
}

export function printUsageSummary(usage: TokenUsage): void {
  const totalTokens = usage.inputTokens + usage.outputTokens;
  const cost = calculateCost(
    usage,
    config.inputTokenPrice,
    config.outputTokenPrice,
  );

  console.log("\n--- Token Usage ---");
  console.log(`  Input tokens:  ${usage.inputTokens.toLocaleString()}`);
  console.log(`  Output tokens: ${usage.outputTokens.toLocaleString()}`);
  console.log(`  Total tokens:  ${totalTokens.toLocaleString()}`);
  console.log(`  Cost:          $${cost.toFixed(4)}`);
  console.log("-------------------");
}
