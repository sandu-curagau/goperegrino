import { computed, effect, inject, Injectable, signal } from '@angular/core';
import { DemoStore, Language } from './demo-store';
import type { translations as english } from './locale.en';
import { translations as portuguese } from './locale.pt';

export type Message = keyof typeof english;
type Catalog = Record<Message, string>;

const loaders: Partial<Record<Language, () => Promise<Catalog>>> = {
  en: () => import('./locale.en').then((module) => module.translations),
  es: () => import('./locale.es').then((module) => module.translations),
  zh: () => import('./locale.zh').then((module) => module.chinese),
  fr: () => import('./locale.fr').then((module) => module.translations),
  de: () => import('./locale.de').then((module) => module.translations),
  it: () => import('./locale.it').then((module) => module.translations),
  nl: () => import('./locale.nl').then((module) => module.translations),
  pl: () => import('./locale.pl').then((module) => module.translations),
  ko: () => import('./locale.ko').then((module) => module.translations),
};
const tags: Record<Language, string> = {
  pt: 'pt-PT',
  en: 'en-GB',
  es: 'es-ES',
  zh: 'zh-Hans',
  fr: 'fr-FR',
  de: 'de-DE',
  it: 'it-IT',
  nl: 'nl-NL',
  pl: 'pl-PL',
  ko: 'ko-KR',
};

@Injectable({ providedIn: 'root' })
export class Locale {
  private readonly store = inject(DemoStore);
  private readonly language = computed(() => this.store.state().language);
  private readonly catalogs = signal<Partial<Record<Language, Catalog>>>({
    pt: portuguese,
  });
  private readonly requests = new Map<Language, Promise<Catalog>>();
  readonly tag = computed(() => tags[this.language()] ?? 'en-GB');

  constructor() {
    effect(() => {
      const language = this.language();
      const loader = loaders[language];
      if (!loader || this.catalogs()[language]) return;
      const request = this.requests.get(language) ?? loader();
      this.requests.set(language, request);
      void request
        .then((catalog) => {
          this.catalogs.update((loaded) => ({ ...loaded, [language]: catalog }));
        })
        .catch(() => {
          this.requests.delete(language);
        });
    });
    effect(() => {
      document.documentElement.lang = this.tag();
      document.title = this.t('prototype');
    });
  }

  t = (key: Message, values: Record<string, string | number> = {}): string => {
    const text = this.catalogs()[this.language()]?.[key] ?? portuguese[key];
    return text.replace(/\{(\w+)\}/g, (_, name: string) => String(values[name] ?? ''));
  };

  original = (key: Message): string => portuguese[key];

  number = (value: number, digits = 0): string =>
    new Intl.NumberFormat(this.tag(), { maximumFractionDigits: digits }).format(value);

  money = (value: number): string =>
    new Intl.NumberFormat(this.tag(), { style: 'currency', currency: 'EUR' }).format(value);

  date = (value: string): string =>
    new Intl.DateTimeFormat(this.tag(), { day: 'numeric', month: 'short' }).format(
      new Date(value.length === 10 ? value + 'T12:00:00' : value),
    );
}
