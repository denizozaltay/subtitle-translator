# Subtitle Translator

[Türkçe](locales/README.tr.md)

AI-powered subtitle translation tool. Supports `.ass` and `.srt` formats. Uses OpenRouter API with structured JSON outputs for consistent, reliable translations.

## Features

- **Structured JSON I/O**: All API requests and responses use enforced JSON schemas for consistency
- **Integrity Validation**: Every response is verified by matching `id` and `original` fields back to the input
- **Auto Retry**: Mismatched or malformed responses automatically trigger retries with exponential backoff
- **ASS Format Safety**: Post-processing ensures `\N` line breaks are always preserved correctly
- **Context Awareness**: First 10 lines are translated one by one with growing context
- **Auto Revision**: Warmup translations are reviewed and corrected as a batch
- **Batch Translation**: Remaining lines are translated in groups of 10
- **Token Usage Tracking**: Displays total input/output tokens and cost at the end
- **Multi-Format Support**: ASS and SRT subtitle files

## Installation

```bash
pnpm install
```

## Configuration

### 1. API Key

Create a `.env` file:

```
OPENROUTER_API_KEY=your_api_key_here
```

### 2. Translation Settings

Edit `src/config.ts`:

```typescript
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
```

## Usage

1. Place your subtitle file (`.ass` or `.srt`) in the project root
2. Update `inputFile` and `outputFile` in `src/config.ts`
3. Run:

```bash
pnpm build
pnpm start
```

## Translation Algorithm

### Phase 1 — Warmup

First 10 lines are translated one by one. Each line sees all previous translations as context.

### Phase 2 — Revision

The warmup translations are reviewed and corrected as a batch for consistency.

### Phase 3 — Batch Translation

Remaining lines are translated in groups of 10. Each batch uses the previous 10 translations as context.

### Structured I/O Format

**Input** sent to the model:

```json
{
  "context": [
    { "id": 1, "original": "I've learned one thing.", "translated": "Bir şey öğrendim." }
  ],
  "to_translate": [
    { "id": 2, "original": "What do you mean?" }
  ]
}
```

**Output** enforced via JSON schema:

```json
{
  "translations": [
    { "id": 2, "original": "What do you mean?", "translated": "Ne demek istiyorsun?" }
  ]
}
```

Each response is validated: `id` and `original` must match the input exactly, otherwise the batch is retried.

## Project Structure

```
src/
├── config.ts
├── main.ts
├── types/
│   ├── index.ts
│   ├── subtitle.ts
│   └── translator.ts
├── parser/
│   ├── index.ts
│   ├── assParser.ts
│   └── srtParser.ts
├── translator/
│   ├── index.ts
│   ├── api.ts
│   ├── schema.ts
│   ├── validation.ts
│   ├── prompts.ts
│   └── translateBatch.ts
└── utils/
    ├── index.ts
    ├── fileHandler.ts
    └── retryHandler.ts
```

## License

GPL-3.0
