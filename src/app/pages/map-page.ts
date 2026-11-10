import { Component, computed, effect, inject, signal } from '@angular/core';
import { IonIcon } from '@ionic/angular';
import { DemoStore } from '../demo/demo-store';
import { Locale, Message } from '../demo/locale';
import { Point } from '../demo/models';
import { Sheet } from '../demo/sheet';
import { TrailMap } from './trail-map';
import { TrailSketch } from './trail-sketch';

type MapSheet = 'sos' | 'warnings';
interface Weather {
  temperature: number;
  icon: string;
  simulated: boolean;
}

@Component({
  imports: [IonIcon, Sheet, TrailMap, TrailSketch],
  templateUrl: './map-page.html',
  styleUrl: './map-page.scss',
})
export class MapPage {
  protected readonly store = inject(DemoStore);
  protected readonly locale = inject(Locale);
  protected readonly weather = signal<Weather>({
    temperature: 17,
    icon: 'partly-sunny-outline',
    simulated: true,
  });
  protected readonly openSheet = signal<MapSheet | null>(null);
  protected readonly recenter = signal(0);
  protected readonly mapLoaded = signal<boolean | undefined>(undefined);
  protected readonly copied = signal(false);
  protected readonly link = signal('');
  protected readonly displayMap = computed(
    () => !this.store.state().offline || !!this.store.state().premium,
  );
  protected readonly roundedPosition = computed(() =>
    this.store
      .progress()
      .position?.map((value) => value.toFixed(5))
      .join(', '),
  );
  private readonly weatherCache = new Map<string, Weather>();

  constructor() {
    effect((onCleanup) => {
      const stage = this.store.stage();
      const route = this.store.route();
      const offline = this.store.offline();
      if (!stage || !route) return;
      const key = route.id + stage.id;
      const fallback = {
        temperature: 15 + (stage.id % 7),
        icon: 'partly-sunny-outline',
        simulated: true,
      };
      this.weather.set(this.weatherCache.get(key) ?? fallback);
      if (offline || this.weatherCache.has(key) || !this.store.started()) return;
      const controller = new AbortController();
      onCleanup(() => controller.abort());
      void this.loadWeather(stage.end, key, controller.signal);
    });
  }

  protected warningKey(id: string, body = false): Message {
    return ('warning' + id + (body ? 'Text' : '')) as Message;
  }

  protected async share(): Promise<void> {
    const point = this.store.progress().position;
    if (!point) return;
    const [lon, lat] = point.map((value) => value.toFixed(5));
    const url = `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=16/${lat}/${lon}`;
    this.link.set(url);
    try {
      await navigator.clipboard.writeText(url);
      this.copied.set(true);
    } catch {
      this.copied.set(false);
    }
  }

  protected sos(): void {
    this.copied.set(false);
    this.link.set('');
    this.openSheet.set('sos');
  }

  private async loadWeather(
    [longitude, latitude]: Point,
    key: string,
    signal: AbortSignal,
  ): Promise<void> {
    try {
      const params = new URLSearchParams({
        latitude: String(latitude),
        longitude: String(longitude),
        current: 'temperature_2m,weather_code',
      });
      const response = await fetch('https://api.open-meteo.com/v1/forecast?' + params, {
        signal: AbortSignal.any([signal, AbortSignal.timeout(5000)]),
      });
      if (!response.ok) return;
      const { current } = await response.json();
      if (!Number.isFinite(current?.temperature_2m) || signal.aborted) return;
      const weather = {
        temperature: Math.round(current.temperature_2m),
        icon:
          current.weather_code === 0
            ? 'sunny-outline'
            : current.weather_code < 4
              ? 'partly-sunny-outline'
              : 'rainy-outline',
        simulated: false,
      };
      this.weatherCache.set(key, weather);
      this.weather.set(weather);
    } catch {
      // The deterministic forecast remains visible if the live request fails.
    }
  }
}
