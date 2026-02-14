import { describe, it } from "node:test";
import assert from "node:assert";
import {
  buildSystemPrompt,
  buildUserPrompt,
  parseJsonResponse,
} from "../../src/translator/openRouterClient";

describe("buildSystemPrompt", () => {
  it("includes target language", () => {
    const prompt = buildSystemPrompt("Turkish");
    assert.ok(prompt.includes("Turkish"));
  });

  it("includes formatting preservation rules", () => {
    const prompt = buildSystemPrompt("Turkish");
    assert.ok(prompt.includes("\\N"));
    assert.ok(prompt.includes("ASS"));
  });

  it("includes context usage instruction", () => {
    const prompt = buildSystemPrompt("Turkish");
    assert.ok(prompt.includes("context"));
    assert.ok(prompt.includes("consistency"));
  });
});

describe("buildUserPrompt", () => {
  it("produces valid JSON with sentences", () => {
    const prompt = buildUserPrompt(["Hello", "World"], []);
    const parsed = JSON.parse(prompt);

    assert.deepStrictEqual(parsed.sentences, [
      { id: 1, text: "Hello" },
      { id: 2, text: "World" },
    ]);
  });

  it("includes context when provided", () => {
    const context = [{ original: "Hi", translation: "Merhaba" }];
    const prompt = buildUserPrompt(["Bye"], context);
    const parsed = JSON.parse(prompt);

    assert.deepStrictEqual(parsed.context, context);
    assert.strictEqual(parsed.sentences.length, 1);
  });

  it("sends empty context for first batch", () => {
    const prompt = buildUserPrompt(["Hello"], []);
    const parsed = JSON.parse(prompt);

    assert.deepStrictEqual(parsed.context, []);
  });

  it("assigns sequential IDs starting from 1", () => {
    const prompt = buildUserPrompt(["a", "b", "c"], []);
    const parsed = JSON.parse(prompt);

    assert.deepStrictEqual(
      parsed.sentences.map((s: { id: number }) => s.id),
      [1, 2, 3],
    );
  });
});

describe("parseJsonResponse", () => {
  it("parses valid response", () => {
    const response = JSON.stringify({
      translations: [
        { id: 1, text: "Merhaba" },
        { id: 2, text: "Dünya" },
      ],
    });

    const result = parseJsonResponse(response, 2);
    assert.deepStrictEqual(result, ["Merhaba", "Dünya"]);
  });

  it("sorts by id", () => {
    const response = JSON.stringify({
      translations: [
        { id: 3, text: "C" },
        { id: 1, text: "A" },
        { id: 2, text: "B" },
      ],
    });

    const result = parseJsonResponse(response, 3);
    assert.deepStrictEqual(result, ["A", "B", "C"]);
  });

  it("slices to expected count", () => {
    const response = JSON.stringify({
      translations: [
        { id: 1, text: "A" },
        { id: 2, text: "B" },
        { id: 3, text: "Extra" },
      ],
    });

    const result = parseJsonResponse(response, 2);
    assert.deepStrictEqual(result, ["A", "B"]);
  });

  it("throws for missing translations array", () => {
    assert.throws(() => parseJsonResponse(JSON.stringify({ data: [] }), 1), {
      message: "Response missing 'translations' array",
    });
  });

  it("throws for invalid JSON", () => {
    assert.throws(() => parseJsonResponse("not json", 1));
  });

  it("handles empty translations array", () => {
    const response = JSON.stringify({ translations: [] });
    const result = parseJsonResponse(response, 0);
    assert.deepStrictEqual(result, []);
  });
});
