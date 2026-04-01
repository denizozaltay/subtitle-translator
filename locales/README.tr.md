# Altyazı Çevirici

AI destekli altyazı çeviri aracı. `.ass` ve `.srt` formatlarını destekler. Tutarlı ve güvenilir çeviriler için yapılandırılmış JSON çıktıları ile OpenRouter API kullanır.

## Özellikler

- **Yapılandırılmış JSON I/O**: Tüm API istek ve yanıtları zorunlu JSON şema ile yapılır
- **Bütünlük Doğrulama**: Her yanıt, `id` ve `original` alanlarının girdiyle eşleşmesi kontrol edilerek doğrulanır
- **Otomatik Yeniden Deneme**: Uyuşmayan veya hatalı yanıtlar otomatik olarak yeniden denenir
- **ASS Format Güvenliği**: Post-processing ile `\N` satır kırmaları her zaman doğru korunur
- **Bağlam Farkındalığı**: İlk 10 satır artan bağlamla teker teker çevrilir
- **Otomatik Revizyon**: Isınma çevirileri toplu olarak gözden geçirilir ve düzeltilir
- **Toplu Çeviri**: Kalan satırlar 10'arlı gruplar halinde çevrilir
- **Token Kullanım Takibi**: İşlem sonunda toplam input/output token ve maliyet gösterilir
- **Çoklu Format Desteği**: ASS ve SRT altyazı dosyaları

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

## Kullanım

1. Altyazı dosyanızı (`.ass` veya `.srt`) projenin ana dizinine koyun
2. `src/config.ts` dosyasında `inputFile` ve `outputFile` değerlerini güncelleyin
3. Çalıştırın:

```bash
pnpm build
pnpm start
```

## Çeviri Algoritması

### Phase 1 — Isınma

İlk 10 satır teker teker çevrilir. Her satır, önceki tüm çevirileri bağlam olarak görür.

### Phase 2 — Revizyon

Isınma çevirileri toplu olarak gözden geçirilir ve tutarlılık için düzeltilir.

### Phase 3 — Toplu Çeviri

Kalan satırlar 10'arlı gruplar halinde çevrilir. Her grup, önceki 10 çeviriyi bağlam olarak kullanır.

### Yapılandırılmış I/O Formatı

Modele gönderilen **girdi**:

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

JSON şema ile zorunlu kılınan **çıktı**:

```json
{
  "translations": [
    { "id": 2, "original": "What do you mean?", "translated": "Ne demek istiyorsun?" }
  ]
}
```

Her yanıt doğrulanır: `id` ve `original` girdiyle birebir eşleşmelidir, aksi halde batch yeniden denenir.

## Proje Yapısı

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

## Lisans

GPL-3.0
