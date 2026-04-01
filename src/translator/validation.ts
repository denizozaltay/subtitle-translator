import { TranslateItem, TranslationOutput } from "../types";

export function validateAndExtract(
  expectedItems: TranslateItem[],
  content: string
): string[] {
  const parsed: TranslationOutput = JSON.parse(content);
  const output = parsed.translations;

  if (output.length !== expectedItems.length) {
    throw new Error(
      `Count mismatch: expected ${expectedItems.length} translations, got ${output.length}`
    );
  }

  const translations: string[] = [];

  for (let i = 0; i < expectedItems.length; i++) {
    const expected = expectedItems[i];
    const received = output[i];

    if (received.id !== expected.id) {
      throw new Error(
        `ID mismatch at index ${i}: expected ${expected.id}, got ${received.id}`
      );
    }

    if (normalize(received.original) !== normalize(expected.original)) {
      throw new Error(
        `Original text mismatch for id ${expected.id}: ` +
          `expected "${expected.original}", got "${received.original}"`
      );
    }

    translations.push(restoreAssLineBreaks(received.translated));
  }

  return translations;
}

function normalize(text: string): string {
  return text
    .replace(/\\N/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function restoreAssLineBreaks(text: string): string {
  return text
    .replace(/\n/g, "\\N")
    .replace(/\\n/g, "\\N");
}
