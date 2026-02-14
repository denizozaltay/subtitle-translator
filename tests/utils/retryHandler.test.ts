import { describe, it } from "node:test";
import assert from "node:assert";
import {
  withRetry,
  isValidBatchTranslation,
} from "../../src/utils/retryHandler";

describe("isValidBatchTranslation", () => {
  it("returns true for valid batch", () => {
    assert.strictEqual(isValidBatchTranslation(["hello", "world"], 2), true);
  });

  it("returns false for wrong count", () => {
    assert.strictEqual(isValidBatchTranslation(["hello"], 2), false);
  });

  it("returns false for empty strings", () => {
    assert.strictEqual(isValidBatchTranslation(["hello", ""], 2), false);
  });

  it("returns false for whitespace-only strings", () => {
    assert.strictEqual(isValidBatchTranslation(["hello", "  "], 2), false);
  });

  it("returns false for empty array when expecting items", () => {
    assert.strictEqual(isValidBatchTranslation([], 1), false);
  });

  it("returns true for empty array when expecting zero", () => {
    assert.strictEqual(isValidBatchTranslation([], 0), true);
  });
});

describe("withRetry", () => {
  it("returns on first successful attempt", async () => {
    let callCount = 0;
    const op = async () => {
      callCount++;
      return "result";
    };

    const result = await withRetry(op, () => true, {
      maxRetries: 3,
      baseDelayMs: 1,
      maxDelayMs: 10,
    });

    assert.strictEqual(result, "result");
    assert.strictEqual(callCount, 1);
  });

  it("retries on validation failure until success", async () => {
    let attempt = 0;
    const op = async () => {
      attempt++;
      return attempt >= 3 ? "valid" : "invalid";
    };

    const result = await withRetry(op, (r) => r === "valid", {
      maxRetries: 5,
      baseDelayMs: 1,
      maxDelayMs: 10,
    });

    assert.strictEqual(result, "valid");
    assert.strictEqual(attempt, 3);
  });

  it("retries on thrown error until success", async () => {
    let attempt = 0;
    const op = async () => {
      attempt++;
      if (attempt < 2) throw new Error("temporary failure");
      return "recovered";
    };

    const result = await withRetry(op, () => true, {
      maxRetries: 5,
      baseDelayMs: 1,
      maxDelayMs: 10,
    });

    assert.strictEqual(result, "recovered");
    assert.strictEqual(attempt, 2);
  });

  it("returns last result after max retries if validation always fails", async () => {
    const op = async () => "always-invalid";

    const result = await withRetry(op, () => false, {
      maxRetries: 3,
      baseDelayMs: 1,
      maxDelayMs: 10,
    });

    assert.strictEqual(result, "always-invalid");
  });

  it("throws after max retries if operation always throws", async () => {
    const op = async () => {
      throw new Error("persistent failure");
    };

    await assert.rejects(
      () =>
        withRetry(op, () => true, {
          maxRetries: 3,
          baseDelayMs: 1,
          maxDelayMs: 10,
        }),
      { message: "persistent failure" },
    );
  });
});
