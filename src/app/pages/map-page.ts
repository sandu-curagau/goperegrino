import { Component, computed, effect, inject, signal } from '@angular/core';
import { IonIcon } from '@ionic/angular';
import { DemoStore } from '../demo/demo-store';
import { Locale, Message } from '../demo/locale';
import { kmBetween, Lodging, lodgingPoint, Point } from '../demo/models';
import { Sheet } from '../demo/sheet';
import { TrailMap } from './trail-map';
import { TrailSketch } from './trail-sketch';
import { LodgingFlow } from './lodging-flow';

type MapSheet = 'sos' | 'warnings' | 'lodgings' | 'filters' | 'detail';
interface Weather {
  temperature: number;
  icon: string;
  simulated: boolean;
}

@Component({
  imports: [IonIcon, Sheet, TrailMap, TrailSketch, LodgingFlow],
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
  protected readonly showPins = signal(false);
  protected readonly focusLodging = signal(false);
  protected readonly selectedId = signal<string | null>(null);
  protected readonly filters = signal({ price: 90, laundry: false, pets: false });
  protected readonly lodgings = computed(() => {
    const filter = this.filters();
    const items = this.store.nearbyLodgings();
    return this.store.premium()
      ? items.filter(
          (item) =>
            item.price <= filter.price &&
            (!filter.laundry || item.facilities.includes('laundry')) &&
            (!filter.pets || item.facilities.includes('pets')),
        )
      : items;
  });
  protected readonly pins = computed(() => (this.showPins() ? this.lodgings() : []));
  protected readonly selected = computed(() =>
    this.lodgings().find((item) => item.id === this.selectedId()),
  );
  protected readonly target = computed(() => {
    if (!this.focusLodging()) return undefined;
    const selected = this.selected();
    return selected ? lodgingPoint(selected) : this.store.stage()?.end;
  });
  protected readonly distanceToTrail = computed(() => {
    const item = this.selected();
    if (!item) return 0;
    const point = lodgingPoint(item);
    const line = this.store.geometry()[item.stageId - 1] ?? [];
    return line.reduce((distance, end, index) => {
      if (!index) return Math.min(distance, kmBetween(point, end));
      const start = line[index - 1];
      const [dx, dy] = [end[0] - start[0], end[1] - start[1]];
      const square = dx * dx + dy * dy;
      if (!square) return distance;
      const t = Math.min(
        1,
        Math.max(0, ((point[0] - start[0]) * dx + (point[1] - start[1]) * dy) / square),
      );
      return Math.min(distance, kmBetween(point, [start[0] + dx * t, start[1] + dy * t]));
    }, Infinity);
  });
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
  private readonly travel = computed(() => {
    const { distance, routeId } = this.store.state();
    return routeId + ':' + distance;
  });

  constructor() {
    effect(() => {
      this.travel();
      this.focusLodging.set(false);
      this.selectedId.set(null);
    });
    effect(() => {
      const id = this.store.mapLodging();
      if (!id) return;
      this.selectLodging(id);
      this.store.mapLodging.set(null);
    });
    effect(() => {
      if (!this.store.started()) {
        this.showPins.set(false);
        this.focusLodging.set(false);
        this.selectedId.set(null);
        this.openSheet.set(null);
        this.filters.set({ price: 90, laundry: false, pets: false });
      }
    });
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

  protected selectLodging(id: string): void {
    this.store.playing.set(false);
    this.selectedId.set(id);
    this.showPins.set(true);
    this.focusLodging.set(true);
    this.store.arrival.set(null);
    this.openSheet.set(null);
  }

  protected togglePins(): void {
    const next = !this.showPins();
    this.showPins.set(next);
    this.focusLodging.set(next);
    if (next) {
      this.store.playing.set(false);
      this.store.arrival.set(null);
    } else this.selectedId.set(null);
  }

  protected showStays(): void {
    if (!this.showPins()) this.togglePins();
    this.openSheet.set('lodgings');
  }

  protected centerWalker(): void {
    this.focusLodging.set(false);
    this.recenter.update((value) => value + 1);
  }

  protected propertyLocation(item: Lodging): string {
    return item.location.address.split(' · ')[0];
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
