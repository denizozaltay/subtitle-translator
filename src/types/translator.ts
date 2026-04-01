export interface ContextItem {
  id: number;
  original: string;
  translated: string;
}

export interface TranslateItem {
  id: number;
  original: string;
}

export interface TranslationOutputItem {
  id: number;
  original: string;
  translated: string;
}

export interface TranslationOutput {
  translations: TranslationOutputItem[];
}
