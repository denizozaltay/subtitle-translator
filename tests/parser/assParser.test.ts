import { describe, it } from "node:test";
import assert from "node:assert";
import { parseAssFile, rebuildAssFile } from "../../src/parser/assParser";

const SAMPLE_ASS = `[Script Info]
Title: Test
ScriptType: v4.00+

[V4+ Styles]
Format: Name, Fontname, Fontsize
Style: Default,Arial,20

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:01.00,0:00:02.00,Default,,0,0,0,,Hello world
Dialogue: 0,0:00:03.00,0:00:04.00,Default,,0,0,0,,How are you?`;

describe("parseAssFile", () => {
  it("parses dialogue entries correctly", () => {
    const parsed = parseAssFile(SAMPLE_ASS);

    assert.strictEqual(parsed.format, "ass");
    assert.strictEqual(parsed.entries.length, 2);
    assert.strictEqual(parsed.entries[0].text, "Hello world");
    assert.strictEqual(parsed.entries[1].text, "How are you?");
  });

  it("preserves timing information", () => {
    const parsed = parseAssFile(SAMPLE_ASS);

    assert.strictEqual(parsed.entries[0].startTime, "0:00:01.00");
    assert.strictEqual(parsed.entries[0].endTime, "0:00:02.00");
  });

  it("stores raw data fields", () => {
    const parsed = parseAssFile(SAMPLE_ASS);
    const raw = parsed.entries[0].rawData!;

    assert.strictEqual(raw.layer, "0");
    assert.strictEqual(raw.style, "Default");
    assert.strictEqual(raw.name, "");
  });

  it("collects metadata lines", () => {
    const parsed = parseAssFile(SAMPLE_ASS);
    assert.ok(parsed.metadata.length > 0);
    assert.ok(parsed.metadata.some((l) => l.includes("[Script Info]")));
    assert.ok(parsed.metadata.some((l) => l.includes("[Events]")));
  });

  it("handles text with commas", () => {
    const ass = `[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:01.00,0:00:02.00,Default,,0,0,0,,Hello, world, test`;

    const parsed = parseAssFile(ass);
    assert.strictEqual(parsed.entries[0].text, "Hello, world, test");
  });

  it("handles formatting tags in text", () => {
    const ass = `[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:01.00,0:00:02.00,Default,,0,0,0,,{\\i1}Italic text{\\i0}`;

    const parsed = parseAssFile(ass);
    assert.strictEqual(parsed.entries[0].text, "{\\i1}Italic text{\\i0}");
  });

  it("returns empty entries for file without events", () => {
    const ass = `[Script Info]\nTitle: Empty`;
    const parsed = parseAssFile(ass);
    assert.strictEqual(parsed.entries.length, 0);
  });
});

describe("rebuildAssFile", () => {
  it("rebuilds with original text when no translation set", () => {
    const parsed = parseAssFile(SAMPLE_ASS);
    const rebuilt = rebuildAssFile(parsed);

    assert.ok(rebuilt.includes("Hello world"));
    assert.ok(rebuilt.includes("How are you?"));
  });

  it("uses translated text when available", () => {
    const parsed = parseAssFile(SAMPLE_ASS);
    parsed.entries[0].translatedText = "Merhaba dünya";
    parsed.entries[1].translatedText = "Nasılsın?";

    const rebuilt = rebuildAssFile(parsed);

    assert.ok(rebuilt.includes("Merhaba dünya"));
    assert.ok(rebuilt.includes("Nasılsın?"));
    assert.ok(!rebuilt.includes("Hello world"));
  });

  it("preserves metadata sections", () => {
    const parsed = parseAssFile(SAMPLE_ASS);
    const rebuilt = rebuildAssFile(parsed);

    assert.ok(rebuilt.includes("[Script Info]"));
    assert.ok(rebuilt.includes("[V4+ Styles]"));
    assert.ok(rebuilt.includes("[Events]"));
  });

  it("round-trips correctly", () => {
    const parsed = parseAssFile(SAMPLE_ASS);
    const rebuilt = rebuildAssFile(parsed);
    const reparsed = parseAssFile(rebuilt);

    assert.strictEqual(reparsed.entries.length, parsed.entries.length);
    assert.strictEqual(reparsed.entries[0].text, parsed.entries[0].text);
    assert.strictEqual(reparsed.entries[1].text, parsed.entries[1].text);
  });
});
