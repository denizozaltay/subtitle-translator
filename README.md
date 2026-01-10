# Anime Subtitle Translator

AI-powered anime subtitle translation tool. Supports `.ass` and `.srt` formats.

## Features

- **Multi-Format Support**: Translates ASS and SRT subtitle files
- **Context Awareness**: Translates the first 10 lines one by one with growing context for consistency
- **Auto Revision**: Reviews and corrects warmup translations
- **Batch Translation**: Quickly translates remaining lines in groups of 10
- **Format Preservation**: Preserves style tags like `\N`, `{\i1}`, `{\pos(x,y)}`

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
  inputFile: "subtitle.srt",       // Source file (.ass or .srt)
  outputFile: "subtitle_tr.srt",   // Output file
  targetLanguage: "Turkish",       // Target language

  warmupCount: 10,                 // First N lines for context building
  batchSize: 10,                   // Batch translation group size
  delayMs: 300,                    // Delay between API requests (ms)

  model: "google/gemini-3-flash-preview",
  apiUrl: "https://openrouter.ai/api/v1/chat/completions",
};
```

## Usage

```bash
pnpm build
pnpm start
```

## Translation Algorithm

1. **Phase 1 - Warmup**: First 10 lines are translated one by one. Each line sees previous translations as context.
2. **Phase 2 - Revision**: The 10-line translation is reviewed and corrected if needed.
3. **Phase 3 - Batch Translation**: Remaining lines are translated in groups of 10. Each group uses the previous 10 lines as context.

## Project Structure

```
src/
├── config.ts              # Configuration settings
├── main.ts                # Main entry point
├── types/
│   └── subtitle.ts        # Type definitions
├── parser/
│   ├── index.ts           # Parser router
│   ├── assParser.ts       # ASS file parser
│   └── srtParser.ts       # SRT file parser
├── translator/
│   ├── index.ts           # Translator export
│   └── openRouterClient.ts # OpenRouter API client
└── utils/
    ├── index.ts           # Utils export
    └── fileHandler.ts     # File operations
```

## License

GPL-3.0
