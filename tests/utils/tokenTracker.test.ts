import { describe, it } from "node:test";
import assert from "node:assert";
import {
  createEmptyUsage,
  addUsage,
  calculateCost,
  TokenUsage,
} from "../../src/utils/tokenTracker";

describe("createEmptyUsage", () => {
  it("returns zeroed usage", () => {
    const usage = createEmptyUsage();
    assert.strictEqual(usage.inputTokens, 0);
    assert.strictEqual(usage.outputTokens, 0);
  });
});

describe("addUsage", () => {
  it("accumulates token counts", () => {
    const total = createEmptyUsage();

    addUsage(total, { inputTokens: 100, outputTokens: 50 });
    assert.strictEqual(total.inputTokens, 100);
    assert.strictEqual(total.outputTokens, 50);

    addUsage(total, { inputTokens: 200, outputTokens: 75 });
    assert.strictEqual(total.inputTokens, 300);
    assert.strictEqual(total.outputTokens, 125);
  });

  it("handles zero additions", () => {
    const total: TokenUsage = { inputTokens: 50, outputTokens: 30 };
    addUsage(total, createEmptyUsage());
    assert.strictEqual(total.inputTokens, 50);
    assert.strictEqual(total.outputTokens, 30);
  });
});

describe("calculateCost", () => {
  it("calculates cost from token counts and prices", () => {
    const usage: TokenUsage = { inputTokens: 1_000_000, outputTokens: 500_000 };
    const cost = calculateCost(usage, 0.1, 0.4);
    assert.ok(Math.abs(cost - 0.3) < 0.0001);
  });

  it("returns zero for empty usage", () => {
    const cost = calculateCost(createEmptyUsage(), 0.1, 0.4);
    assert.strictEqual(cost, 0);
  });

  it("scales linearly with token count", () => {
    const small: TokenUsage = { inputTokens: 1000, outputTokens: 500 };
    const large: TokenUsage = { inputTokens: 10_000, outputTokens: 5000 };

    const smallCost = calculateCost(small, 1.0, 2.0);
    const largeCost = calculateCost(large, 1.0, 2.0);

    assert.ok(Math.abs(largeCost / smallCost - 10) < 0.0001);
  });
});
