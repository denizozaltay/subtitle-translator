# Anime Altyazı Çevirici

AI destekli anime altyazı çeviri aracı. `.ass` ve `.srt` formatlarını destekler.

## Özellikler

- **Çoklu Format Desteği**: ASS ve SRT altyazı dosyalarını çevirir
- **Bağlam Farkındalığı**: İlk 10 satırı artan bağlamla teker teker çevirir, tutarlılık sağlar
- **Otomatik Revizyon**: Isınma çevirilerini gözden geçirip düzeltir
- **Toplu Çeviri**: Kalan satırları 10'arlı gruplar halinde hızlıca çevirir
- **Format Koruma**: `\N`, `{\i1}`, `{\pos(x,y)}` gibi stil etiketlerini korur

## Kurulum

```bash
pnpm install
```

## Yapılandırma

### 1. API Anahtarı

`.env` dosyası oluşturun:

```
OPENROUTER_API_KEY=your_api_key_here
```

### 2. Çeviri Ayarları

`src/config.ts` dosyasını düzenleyin:

```typescript
export const config = {
  inputFile: "subtitle.srt",       // Kaynak dosya (.ass veya .srt)
  outputFile: "subtitle_tr.srt",   // Çıktı dosyası
  targetLanguage: "Turkish",       // Hedef dil

  warmupCount: 10,                 // Bağlam oluşturma için ilk N satır
  batchSize: 10,                   // Toplu çeviri grup boyutu
  delayMs: 300,                    // API istekleri arası bekleme (ms)

  model: "google/gemini-3-flash-preview",
  apiUrl: "https://openrouter.ai/api/v1/chat/completions",
};
```

## Kullanım

1. Altyazı dosyanızı (`.ass` veya `.srt`) projenin ana dizinine koyun
2. `src/config.ts` dosyasında `inputFile` ve `outputFile` değerlerini güncelleyin
3. Çalıştırın:

```bash
pnpm build
pnpm start
```

## Çeviri Algoritması

1. **Phase 1 - Isınma**: İlk 10 satır teker teker çevrilir. Her satır, önceki çevirileri bağlam olarak görür.
2. **Phase 2 - Revizyon**: 10 satırlık çeviri gözden geçirilir ve gerekirse düzeltilir.
3. **Phase 3 - Toplu Çeviri**: Kalan satırlar 10'arlı gruplar halinde çevrilir. Her grup, önceki 10 satırı bağlam olarak kullanır.

## Proje Yapısı

```
src/
├── config.ts              # Yapılandırma ayarları
├── main.ts                # Ana giriş noktası
├── types/
│   └── subtitle.ts        # Tip tanımlamaları
├── parser/
│   ├── index.ts           # Parser router
│   ├── assParser.ts       # ASS dosya parser
│   └── srtParser.ts       # SRT dosya parser
├── translator/
│   ├── index.ts           # Translator export
│   └── openRouterClient.ts # OpenRouter API client
└── utils/
    ├── index.ts           # Utils export
    └── fileHandler.ts     # Dosya işlemleri
```

## Lisans

GPL-3.0
