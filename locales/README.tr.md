# Altyazı Çevirici

AI destekli altyazı çeviri aracı. `.ass` ve `.srt` formatlarını destekler.

## Özellikler

- **Çoklu Format Desteği**: ASS ve SRT altyazı dosyalarını çevirir
- **Kayan Bağlam Penceresi**: Her grup önceki 30 çeviriyi bağlam olarak görür, tutarlılık sağlar
- **Yapılandırılmış Çıktı**: API yanıtları JSON Schema ile doğrulanır
- **Toplu Çeviri**: Satırları 30'arlı gruplar halinde otomatik yeniden denemeyle çevirir
- **Format Koruma**: `\N`, `{\i1}`, `{\pos(x,y)}` gibi stil etiketlerini korur
- **Token & Maliyet Takibi**: Çeviri sonunda toplam token kullanımını ve tahmini maliyeti gösterir

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
  inputFile: "subtitle.ass", // Kaynak dosya (.ass veya .srt)
  outputFile: "subtitle_tr.ass", // Çıktı dosyası
  targetLanguage: "Turkish", // Hedef dil

  batchSize: 30, // Toplu çeviri grup boyutu
  delayMs: 300, // API istekleri arası bekleme (ms)

  maxRetries: 10, // Grup başına max deneme sayısı
  retryBaseDelayMs: 1000, // Üstel geri çekilme baz gecikmesi
  retryMaxDelayMs: 10000, // Denemeler arası max gecikme

  model: "google/gemini-3-flash-preview",
  apiUrl: "https://openrouter.ai/api/v1/chat/completions",

  inputTokenPrice: 0.1, // $/1M input token
  outputTokenPrice: 0.4, // $/1M output token
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

### Örnek Çıktı

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

## Çeviri Algoritması

1. **Ayrıştır**: Formatı algıla (ASS/SRT) ve diyalog satırlarını çıkar
2. **Toplu Çevir**: Kayan bağlam penceresiyle (önceki 30 orijinal/çeviri çifti) 30'arlı gruplar halinde çevir
3. **Yapılandırılmış Çıktı**: API yanıtları JSON Schema ile zorlanarak tip güvenli sonuçlar elde edilir
4. **Yeniden Dene**: Başarısız gruplar üstel geri çekilmeyle yeniden denenir (en fazla 10 deneme)
5. **Yeniden Oluştur**: Çevirilerle altyazı dosyasını yeniden birleştir, tüm metaverileri ve formatlamayı koru

## Testler

```bash
pnpm test
```

Parser, translator, utility ve retry mantığını kapsayan 71 test.

## Proje Yapısı

```
src/
├── config.ts                # Yapılandırma ayarları
├── main.ts                  # Ana giriş noktası
├── types/
│   └── subtitle.ts          # Tip tanımlamaları
├── parser/
│   ├── index.ts             # Parser yönlendirici
│   ├── assParser.ts         # ASS dosya ayrıştırıcı
│   └── srtParser.ts         # SRT dosya ayrıştırıcı
├── translator/
│   ├── index.ts             # Translator export
│   └── openRouterClient.ts  # OpenRouter API istemcisi
└── utils/
    ├── index.ts             # Utils export
    ├── fileHandler.ts       # Dosya işlemleri
    ├── retryHandler.ts      # Üstel geri çekilmeli yeniden deneme
    └── tokenTracker.ts      # Token kullanımı & maliyet takibi
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

## Lisans

GPL-3.0
