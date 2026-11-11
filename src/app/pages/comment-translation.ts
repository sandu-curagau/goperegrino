import { inject, Injectable, signal } from '@angular/core';
import { DemoStore } from '../demo/demo-store';
import type { Message } from '../demo/locale';

interface BrowserTranslator {
  translate(text: string): Promise<string>;
  destroy(): void;
}

interface BrowserLanguageDetector {
  detect(text: string): Promise<{ detectedLanguage: string; confidence: number }[]>;
  destroy(): void;
}

type TranslatorOptions = { sourceLanguage: string; targetLanguage: string };
const browser = globalThis as typeof globalThis & {
  Translator?: {
    availability(options: TranslatorOptions): Promise<string>;
    create(options: TranslatorOptions & { signal: AbortSignal }): Promise<BrowserTranslator>;
  };
  LanguageDetector?: {
    availability(): Promise<string>;
    create(): Promise<BrowserLanguageDetector>;
  };
};

export interface TranslatableComment {
  id: string;
  message: string;
  original?: string;
  language?: string;
}

interface Translation {
  text?: string;
  showOriginal?: boolean;
  pending?: boolean;
  error?: Message;
}

const serviceLanguages: Record<string, string> = { pt: 'pt-PT', zh: 'zh-CN' };

function translationSegments(text: string, language: string): string[] {
  const parts: string[] = [];
  const encoder = new TextEncoder();
  let chunk = '';
  let bytes = 0;
  const words = new Intl.Segmenter(language, { granularity: 'word' }).segment(text);
  for (const { segment } of words) {
    const units = encoder.encode(segment).length > 500 ? Array.from(segment) : [segment];
    for (const unit of units) {
      const size = encoder.encode(unit).length;
      if (bytes + size > 500) {
        if (chunk.trim()) parts.push(chunk.trim());
        chunk = '';
        bytes = 0;
      }
      chunk += unit;
      bytes += size;
    }
  }
  if (chunk.trim()) parts.push(chunk.trim());
  return parts;
}

async function translateOnline(text: string, source: string, target: string): Promise<string> {
  const pair = (serviceLanguages[source] ?? source) + '|' + (serviceLanguages[target] ?? target);
  const signal = AbortSignal.timeout(10000);
  const results = await Promise.all(
    translationSegments(text, source).map(async (part) => {
      const query = new URLSearchParams({ q: part, langpair: pair });
      const response = await fetch('https://api.mymemory.translated.net/get?' + query, {
        signal,
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
      });
      if (!response.ok) throw new Error('Translation request failed');
      const data = await response.json();
      const translated = data.responseData?.translatedText;
      if (Number(data.responseStatus) !== 200 || typeof translated !== 'string')
        throw new Error('Translation unavailable');
      const decoded = document.createElement('textarea');
      decoded.innerHTML = translated.replace(/</g, '&lt;');
      return decoded.value;
    }),
  );
  return results.join(target === 'zh' ? '' : ' ');
}

@Injectable()
export class CommentTranslation {
  private readonly store = inject(DemoStore);
  private readonly cache = signal(new Map<string, Translation>());

  view(comment: TranslatableComment) {
    const target = this.store.state().language;
    const saved = this.cache().get(this.key(comment, target));
    const translated = comment.original ? comment.message : saved?.text;
    return {
      message: saved?.showOriginal
        ? (comment.original ?? comment.message)
        : (translated ?? comment.message),
      action: (saved?.pending
        ? 'translatingComment'
        : translated && !saved?.showOriginal
          ? 'showOriginalComment'
          : comment.original || translated
            ? 'translateComment'
            : 'translateOnlineComment') as Message,
      visible: !comment.original || comment.original !== comment.message,
      disabled: !!saved?.pending || (!comment.original && !saved?.text && this.store.offline()),
      error: saved?.error,
    };
  }

  async toggle(comment: TranslatableComment): Promise<void> {
    const target = this.store.state().language;
    const key = this.key(comment, target);
    const saved = this.cache().get(key);
    if (saved?.pending) return;
    if (comment.original || saved?.text) {
      this.save(key, { ...saved, showOriginal: !saved?.showOriginal });
      return;
    }
    if (this.store.offline()) return;
    this.save(key, { pending: true });
    try {
      const source = await this.sourceLanguage(comment);
      if (source === target) {
        this.save(key, { error: 'commentAlreadyInLanguage' });
        return;
      }
      if (!source) throw new Error('Unknown source language');
      const translated = (await this.translate(comment.message, source, target)).trim();
      if (!translated) throw new Error('Empty translation');
      this.save(key, { text: translated });
    } catch {
      this.save(key, { error: 'commentTranslationFailed' });
    }
  }

  private async translate(text: string, source: string, target: string): Promise<string> {
    const api = browser.Translator;
    const options = { sourceLanguage: source, targetLanguage: target };
    if (api && (await api.availability(options).catch(() => '')) === 'available') {
      try {
        const translator = await api.create({ ...options, signal: AbortSignal.timeout(5000) });
        try {
          return await translator.translate(text);
        } finally {
          translator.destroy();
        }
      } catch {
        /* Use the online service if the browser cannot load its translation model. */
      }
    }
    return translateOnline(text, source, target);
  }

  private async sourceLanguage(comment: TranslatableComment): Promise<string | undefined> {
    const detectorApi = browser.LanguageDetector;
    // Use an already installed detector. A new model can consume the click needed to start translation.
    if (detectorApi && (await detectorApi.availability().catch(() => '')) === 'available') {
      const detector = await detectorApi.create().catch(() => undefined);
      if (detector) {
        try {
          const [best] = await detector.detect(comment.message);
          if (best && best.confidence >= 0.65) return best.detectedLanguage.split('-')[0];
        } catch {
          /* Fall back to the language recorded with the comment. */
        } finally {
          detector.destroy();
        }
      }
    }
    return comment.language;
  }

  private key(comment: TranslatableComment, language: string) {
    return language + ':' + comment.id;
  }

  private save(key: string, value: Translation) {
    this.cache.update((previous) => {
      const next = new Map(previous);
      if (next.size >= 250 && !next.has(key)) next.delete(next.keys().next().value!);
      next.set(key, value);
      return next;
    });
  }
}
