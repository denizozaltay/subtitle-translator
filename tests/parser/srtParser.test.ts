import { describe, it } from "node:test";
import assert from "node:assert";
import { parseSrtFile, rebuildSrtFile } from "../../src/parser/srtParser";

const SAMPLE_SRT = `1
00:00:01,000 --> 00:00:02,000
Hello world

2
00:00:03,000 --> 00:00:04,000
How are you?

3
00:00:05,000 --> 00:00:06,000
I am fine,
thank you`;

describe("parseSrtFile", () => {
  it("parses entries correctly", () => {
    const parsed = parseSrtFile(SAMPLE_SRT);

    assert.strictEqual(parsed.format, "srt");
    assert.strictEqual(parsed.entries.length, 3);
  });

  it("extracts text from entries", () => {
    const parsed = parseSrtFile(SAMPLE_SRT);

    assert.strictEqual(parsed.entries[0].text, "Hello world");
    assert.strictEqual(parsed.entries[1].text, "How are you?");
  });

  it("handles multi-line text", () => {
    const parsed = parseSrtFile(SAMPLE_SRT);

    assert.strictEqual(parsed.entries[2].text, "I am fine,\nthank you");
  });

  it("preserves timing information", () => {
    const parsed = parseSrtFile(SAMPLE_SRT);

    assert.strictEqual(parsed.entries[0].startTime, "00:00:01,000");
    assert.strictEqual(parsed.entries[0].endTime, "00:00:02,000");
  });

  it("preserves entry indices", () => {
    const parsed = parseSrtFile(SAMPLE_SRT);

    assert.strictEqual(parsed.entries[0].index, 1);
    assert.strictEqual(parsed.entries[1].index, 2);
    assert.strictEqual(parsed.entries[2].index, 3);
  });

  it("returns empty entries for invalid content", () => {
    const parsed = parseSrtFile("not a valid srt file");
    assert.strictEqual(parsed.entries.length, 0);
  });

  it("has empty metadata for SRT format", () => {
    const parsed = parseSrtFile(SAMPLE_SRT);
    assert.deepStrictEqual(parsed.metadata, []);
  });
});

describe("rebuildSrtFile", () => {
  it("rebuilds with original text when no translation", () => {
    const parsed = parseSrtFile(SAMPLE_SRT);
    const rebuilt = rebuildSrtFile(parsed);

    assert.ok(rebuilt.includes("Hello world"));
    assert.ok(rebuilt.includes("How are you?"));
  });

  it("uses translated text when available", () => {
    const parsed = parseSrtFile(SAMPLE_SRT);
    parsed.entries[0].translatedText = "Merhaba dünya";
    parsed.entries[1].translatedText = "Nasılsın?";

    const rebuilt = rebuildSrtFile(parsed);

    assert.ok(rebuilt.includes("Merhaba dünya"));
    assert.ok(rebuilt.includes("Nasılsın?"));
    assert.ok(!rebuilt.includes("Hello world"));
  });

  it("preserves timing in rebuilt output", () => {
    const parsed = parseSrtFile(SAMPLE_SRT);
    const rebuilt = rebuildSrtFile(parsed);

    assert.ok(rebuilt.includes("00:00:01,000 --> 00:00:02,000"));
    assert.ok(rebuilt.includes("00:00:03,000 --> 00:00:04,000"));
  });

  it("round-trips single-line entries correctly", () => {
    const simpleSrt = `1\n00:00:01,000 --> 00:00:02,000\nHello\n\n2\n00:00:03,000 --> 00:00:04,000\nWorld`;

    const parsed = parseSrtFile(simpleSrt);
    const rebuilt = rebuildSrtFile(parsed);
    const reparsed = parseSrtFile(rebuilt);

    assert.strictEqual(reparsed.entries.length, 2);
    assert.strictEqual(reparsed.entries[0].text, "Hello");
    assert.strictEqual(reparsed.entries[1].text, "World");
  });
});
