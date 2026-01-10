export interface DialogueLine {
  rawLine: string;
  layer: string;
  start: string;
  end: string;
  style: string;
  name: string;
  marginL: string;
  marginR: string;
  marginV: string;
  effect: string;
  text: string;
  translatedText?: string;
}

export interface ParsedSubtitle {
  scriptInfo: string[];
  styles: string[];
  events: {
    formatLine: string;
    dialogues: DialogueLine[];
    otherLines: string[];
  };
}

export interface TranslationResult {
  original: string;
  translated: string;
}
