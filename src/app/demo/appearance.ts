import { computed, DestroyRef, effect, inject, Injectable, signal } from '@angular/core';
import { DemoStore } from './demo-store';

@Injectable({ providedIn: 'root' })
export class Appearance {
  private readonly store = inject(DemoStore);
  private readonly media = matchMedia('(prefers-color-scheme: dark)');
  private readonly systemDark = signal(this.media.matches);
  readonly dark = computed(() => {
    const preference = this.store.state().theme;
    return preference === 'dark' || (preference !== 'light' && this.systemDark());
  });

  constructor() {
    const update = (event: MediaQueryListEvent) => this.systemDark.set(event.matches);
    this.media.addEventListener('change', update);
    inject(DestroyRef).onDestroy(() => this.media.removeEventListener('change', update));
    effect(() => {
      const dark = this.dark();
      document.documentElement.dataset['theme'] = dark ? 'dark' : 'light';
      document
        .querySelector('meta[name="theme-color"]')
        ?.setAttribute('content', dark ? '#101d27' : '#003058');
    });
  }
}
