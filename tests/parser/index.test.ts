import { describe, it } from "node:test";
import assert from "node:assert";
import {
  parseSubtitle,
  rebuildSubtitle,
  extractTexts,
  getFormatFromExtension,
} from "../../src/parser/index";

const SAMPLE_ASS = `[Script Info]
Title: Test

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:01.00,0:00:02.00,Default,,0,0,0,,Hello
Dialogue: 0,0:00:03.00,0:00:04.00,Default,,0,0,0,,World`;

const SAMPLE_SRT = `1
00:00:01,000 --> 00:00:02,000
Hello

2
00:00:03,000 --> 00:00:04,000
World`;

describe("getFormatFromExtension", () => {
  it("detects SRT format", () => {
    assert.strictEqual(getFormatFromExtension("subtitle.srt"), "srt");
  });

  it("detects ASS format", () => {
    assert.strictEqual(getFormatFromExtension("subtitle.ass"), "ass");
  });

  it("defaults to ASS for unknown extension", () => {
    assert.strictEqual(getFormatFromExtension("subtitle.txt"), "ass");
  });

  it("handles uppercase extensions", () => {
    assert.strictEqual(getFormatFromExtension("subtitle.SRT"), "srt");
  });

  it("handles paths with directories", () => {
    assert.strictEqual(getFormatFromExtension("/path/to/subtitle.srt"), "srt");
  });
});

describe("parseSubtitle", () => {
  it("delegates to ASS parser for ASS format", () => {
    const parsed = parseSubtitle(SAMPLE_ASS, "ass");
    assert.strictEqual(parsed.format, "ass");
    assert.strictEqual(parsed.entries.length, 2);
  });

  it("delegates to SRT parser for SRT format", () => {
    const parsed = parseSubtitle(SAMPLE_SRT, "srt");
    assert.strictEqual(parsed.format, "srt");
    assert.strictEqual(parsed.entries.length, 2);
  });
});

describe("extractTexts", () => {
  it("extracts text array from parsed ASS subtitle", () => {
    const parsed = parseSubtitle(SAMPLE_ASS, "ass");
    const texts = extractTexts(parsed);

    assert.deepStrictEqual(texts, ["Hello", "World"]);
  });

  it("extracts text array from parsed SRT subtitle", () => {
    const parsed = parseSubtitle(SAMPLE_SRT, "srt");
    const texts = extractTexts(parsed);

    assert.deepStrictEqual(texts, ["Hello", "World"]);
  });

  it("returns empty array for empty subtitle", () => {
    const parsed = parseSubtitle("[Script Info]\nTitle: Empty", "ass");
    const texts = extractTexts(parsed);

    assert.deepStrictEqual(texts, []);
  });
});

describe("rebuildSubtitle", () => {
  it("rebuilds ASS format correctly", () => {
    const parsed = parseSubtitle(SAMPLE_ASS, "ass");
    parsed.entries[0].translatedText = "Merhaba";
    const rebuilt = rebuildSubtitle(parsed);

    assert.ok(rebuilt.includes("Merhaba"));
  });

  it("rebuilds SRT format correctly", () => {
    const parsed = parseSubtitle(SAMPLE_SRT, "srt");
    parsed.entries[0].translatedText = "Merhaba";
    const rebuilt = rebuildSubtitle(parsed);

    assert.ok(rebuilt.includes("Merhaba"));
  });
});
