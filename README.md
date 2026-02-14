# Subtitle Translator

[Türkçe](locales/README.tr.md)

AI-powered subtitle translation tool. Supports `.ass` and `.srt` formats.

## Features

- **Multi-Format Support**: Translates ASS and SRT subtitle files
- **Sliding Context Window**: Each batch sees the previous 30 translations for consistency
- **Structured Outputs**: Uses JSON Schema enforcement for reliable API responses
- **Batch Translation**: Translates lines in groups of 30 with automatic retry
- **Format Preservation**: Preserves style tags like `\N`, `{\i1}`, `{\pos(x,y)}`
- **Token & Cost Tracking**: Displays total token usage and estimated cost after translation

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
  inputFile: "subtitle.ass", // Source file (.ass or .srt)
  outputFile: "subtitle_tr.ass", // Output file
  targetLanguage: "Turkish", // Target language

  batchSize: 30, // Batch translation group size
  delayMs: 300, // Delay between API requests (ms)

  maxRetries: 10, // Max retry attempts per batch
  retryBaseDelayMs: 1000, // Base delay for exponential backoff
  retryMaxDelayMs: 10000, // Max delay between retries

  model: "google/gemini-3-flash-preview",
  apiUrl: "https://openrouter.ai/api/v1/chat/completions",

  inputTokenPrice: 0.1, // $/1M input tokens
  outputTokenPrice: 0.4, // $/1M output tokens
};
```

## Usage

1. Place your subtitle file (`.ass` or `.srt`) in the project root directory
2. Update `inputFile` and `outputFile` in `src/config.ts`
3. Run:

```bash
pnpm build
pnpm start
```

### Example Output

```
Translating 371 lines (30 per batch, 13 batches)
  Batch 1/13 (lines 1-30)
  ...
  Batch 13/13 (lines 361-371)

--- Token Usage ---
  Input tokens:  19,044
  Output tokens: 20,714
  Total tokens:  39,758
  Cost:          $0.0102
-------------------
Translation complete! Output saved to: subtitle_tr.ass
```

## Translation Algorithm

1. **Parse**: Detect format (ASS/SRT) and extract dialogue entries
2. **Batch Translate**: Translate in groups of 30 using a sliding context window (previous 30 original/translated pairs)
3. **Structured Output**: API responses are enforced via JSON Schema for type-safe, consistent results
4. **Retry**: Failed batches are retried with exponential backoff (up to 10 attempts)
5. **Rebuild**: Reassemble the subtitle file with translations, preserving all metadata and formatting

## Testing

```bash
pnpm test
```

71 tests covering parsers, translator, utilities and retry logic.

## Project Structure

```
src/
├── config.ts                # Configuration settings
├── main.ts                  # Main entry point
├── types/
│   └── subtitle.ts          # Type definitions
├── parser/
│   ├── index.ts             # Parser router
│   ├── assParser.ts         # ASS file parser
│   └── srtParser.ts         # SRT file parser
├── translator/
│   ├── index.ts             # Translator export
│   └── openRouterClient.ts  # OpenRouter API client
└── utils/
    ├── index.ts             # Utils export
    ├── fileHandler.ts       # File operations
    ├── retryHandler.ts      # Retry with exponential backoff
    └── tokenTracker.ts      # Token usage & cost tracking
tests/
├── parser/
│   ├── assParser.test.ts
│   ├── index.test.ts
│   └── srtParser.test.ts
├── translator/
│   └── openRouterClient.test.ts
└── utils/
    ├── fileHandler.test.ts
    ├── retryHandler.test.ts
    └── tokenTracker.test.ts
```

## License

GPL-3.0
