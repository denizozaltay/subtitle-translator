import { config } from "../config";

interface RetryOptions {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
}

const DEFAULT_OPTIONS: RetryOptions = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 10000,
};

export async function withRetry<T>(
  operation: () => Promise<T>,
  validator: (result: T) => boolean,
  options: Partial<RetryOptions> = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: Error | null = null;
  let lastResult: T | null = null;

  for (let attempt = 1; attempt <= opts.maxRetries; attempt++) {
    try {
      const result = await operation();

      if (validator(result)) {
        return result;
      }

      lastResult = result;
      console.log(`  ⚠ Validation failed on attempt ${attempt}/${opts.maxRetries}`);
    } catch (error) {
      lastError = error as Error;
      console.log(`  ⚠ Error on attempt ${attempt}/${opts.maxRetries}: ${lastError.message}`);
    }

    if (attempt < opts.maxRetries) {
      const delayMs = calculateBackoff(attempt, opts.baseDelayMs, opts.maxDelayMs);
      console.log(`  ⏳ Retrying in ${delayMs}ms...`);
      await delay(delayMs);
    }
  }

  if (lastResult !== null) {
    console.log("  ⚠ Using last result despite validation failure");
    return lastResult;
  }

  throw lastError || new Error("Retry failed with no result");
}

function calculateBackoff(attempt: number, baseMs: number, maxMs: number): number {
  const exponentialDelay = baseMs * Math.pow(2, attempt - 1);
  const jitter = Math.random() * 0.3 * exponentialDelay;
  return Math.min(exponentialDelay + jitter, maxMs);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function isValidTranslation(text: string): boolean {
  if (!text || text.trim() === "") {
    return false;
  }

  if (text.includes("I cannot") || text.includes("I'm sorry")) {
    return false;
  }

  return true;
}

export function isValidBatchTranslation(texts: string[], expectedCount: number): boolean {
  if (texts.length !== expectedCount) {
    return false;
  }

  return texts.every(isValidTranslation);
}
