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

const browser = globalThis as typeof globalThis & {
  Translator?: {
    create(options: {
      sourceLanguage: string;
      targetLanguage: string;
      signal: AbortSignal;
    }): Promise<BrowserTranslator>;
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
          : 'translateComment') as Message,
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
    if (!browser.Translator) {
      this.save(key, { error: 'commentTranslationUnavailable' });
      return;
    }
    this.save(key, { pending: true });
    try {
      const source = await this.sourceLanguage(comment);
      if (source === target) {
        this.save(key, { error: 'commentAlreadyInLanguage' });
        return;
      }
      if (!source) throw new Error('Unknown source language');
      const translator = await browser.Translator.create({
        sourceLanguage: source,
        targetLanguage: target,
        signal: AbortSignal.timeout(45000),
      });
      try {
        const translated = (await translator.translate(comment.message)).trim();
        if (!translated) throw new Error('Empty translation');
        this.save(key, { text: translated });
      } finally {
        translator.destroy();
      }
    } catch {
      this.save(key, { error: 'commentTranslationFailed' });
    }
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
