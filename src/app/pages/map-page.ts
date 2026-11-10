import { Component, computed, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { IonIcon } from '@ionic/angular';
import { DemoStore } from '../demo/demo-store';
import { Locale, Message } from '../demo/locale';
import { distanceToLodging, Lodging, lodgingPoint, Point } from '../demo/models';
import { Sheet } from '../demo/sheet';
import { TrailMap } from './trail-map';
import { LodgingFlow } from './lodging-flow';

type MapSheet = 'sos' | 'warnings' | 'lodgings' | 'filters' | 'detail';
interface Weather {
  temperature: number;
  icon: string;
  simulated: boolean;
}

@Component({
  imports: [IonIcon, Sheet, TrailMap, LodgingFlow],
  templateUrl: './map-page.html',
  styleUrl: './map-page.scss',
})
export class MapPage {
  protected readonly store = inject(DemoStore);
  protected readonly locale = inject(Locale);
  private readonly router = inject(Router);
  protected readonly weather = signal<Weather>({
    temperature: 17,
    icon: 'partly-sunny-outline',
    simulated: true,
  });
  protected readonly openSheet = signal<MapSheet | null>(null);
  protected readonly warningDismissed = signal(false);
  private readonly stageKey = computed(() => this.store.route()?.id + ':' + this.store.stage()?.id);
  protected readonly warningTitle = computed(() => {
    const preview = this.store
      .warnings()
      .find((notice) => notice.type === 'route' || this.store.premium());
    return this.locale.t(preview ? this.warningKey(preview.id) : 'warnings');
  });
  protected readonly recenter = signal(0);
  protected readonly mapLoaded = signal<boolean | undefined>(undefined);
  protected readonly copied = signal(false);
  protected readonly link = signal('');
  protected readonly showPins = signal(false);
  protected readonly selectedId = signal<string | null>(null);
  protected readonly target = signal<Point | undefined>(undefined);
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
  protected readonly pins = computed(() => {
    if (!this.showPins()) return [];
    const items = this.lodgings();
    const selected = this.selected();
    return selected && !items.some((item) => item.id === selected.id)
      ? [...items, selected]
      : items;
  });
  protected readonly selected = computed(() =>
    this.selectedId()
      ? this.store.lodgings().find((item) => item.id === this.selectedId())
      : undefined,
  );
  protected readonly sortedStays = computed(() => {
    const position = this.store.progress().position;
    return this.lodgings()
      .map((item) => ({ item, distance: distanceToLodging(position, item) }))
      .sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity));
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

  constructor() {
    effect(() => {
      this.stageKey();
      this.warningDismissed.set(false);
    });
    effect(() => {
      this.store.cameraRevision();
      this.clearSelection();
    });
    effect(() => {
      const id = this.store.mapLodging();
      if (!id) return;
      this.selectLodging(id, true);
      this.store.mapLodging.set(null);
    });
    effect(() => {
      if (!this.store.started()) {
        this.showPins.set(false);
        this.clearSelection();
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

  protected selectLodging(id: string, center = false): void {
    const item = this.store.lodgings().find((entry) => entry.id === id);
    if (!item) return;
    this.selectedId.set(id);
    this.showPins.set(true);
    this.target.set(center ? lodgingPoint(item) : undefined);
    this.store.arrival.set(null);
    this.openSheet.set(!this.displayMap() || this.mapLoaded() === false ? 'detail' : null);
  }

  protected clearSelection(): void {
    this.selectedId.set(null);
    this.target.set(undefined);
  }

  protected togglePins(): void {
    const next = !this.showPins();
    this.showPins.set(next);
    if (!next) this.clearSelection();
  }

  protected showStays(): void {
    if (!this.showPins()) this.togglePins();
    this.store.arrival.set(null);
    this.openSheet.set('lodgings');
  }

  protected centerWalker(): void {
    this.clearSelection();
    this.recenter.update((value) => value + 1);
  }

  protected finishAction(action: 'passport' | 'route'): void {
    this.store.completionOpen.set(false);
    if (action === 'route') this.store.planningAnother.set(true);
    else void this.router.navigateByUrl('/credencial');
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
