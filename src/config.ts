export const config = {
  inputFile: "subtitle.srt",
  outputFile: "subtitle_tr.srt",
  targetLanguage: "Turkish",

  warmupCount: 10,
  batchSize: 10,
  delayMs: 300,

  maxRetries: 3,
  retryBaseDelayMs: 1000,
  retryMaxDelayMs: 10000,

  model: "google/gemini-3-flash-preview",
  apiUrl: "https://openrouter.ai/api/v1/chat/completions",
};
