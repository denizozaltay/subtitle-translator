export const config = {
  inputFile: "subtitle.ass",
  outputFile: "subtitle_tr.ass",
  targetLanguage: "Turkish",

  warmupCount: 10,
  batchSize: 10,
  delayMs: 300,

  maxRetries: 10,
  retryBaseDelayMs: 1000,
  retryMaxDelayMs: 10000,

  model: "google/gemini-3-flash-preview",
  apiUrl: "https://openrouter.ai/api/v1/chat/completions",
};
