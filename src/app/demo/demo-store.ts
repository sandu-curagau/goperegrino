import { computed, DestroyRef, effect, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  Camino,
  dateInput,
  Lodging,
  Notice,
  Point,
  Reservation,
  Stamp,
  TrailLine,
  Waypoint,
  kmBetween,
} from './models';

export const languages = [
  ['pt', 'Português'],
  ['en', 'English'],
  ['es', 'Español'],
  ['fr', 'Français'],
  ['de', 'Deutsch'],
  ['it', 'Italiano'],
  ['nl', 'Nederlands'],
  ['pl', 'Polski'],
  ['ko', '한국어'],
] as const;
export type Language = (typeof languages)[number][0];

interface DemoState {
  language: Language;
  routeId: string;
  started: boolean;
  date: string;
  days: number;
  distance: number;
  premium: 0 | 7 | 30;
  offline: boolean;
  downloads: string[];
  reservations: Reservation[];
  stamps: Stamp[];
  trustedContact: string;
  notes: Record<string, string>;
  pack: string[];
}

const storageKey = 'goperegrino-demo-v1';
function freshState(): DemoState {
  return {
    language: 'pt',
    routeId: 'central',
    started: false,
    date: dateInput(),
    days: 11,
    distance: 0,
    premium: 0,
    offline: false,
    downloads: [],
    reservations: [],
    stamps: [],
    trustedContact: '',
    notes: {},
    pack: [],
  };
}

function readState(): DemoState {
  try {
    const stored = localStorage.getItem(storageKey);
    return stored ? { ...freshState(), ...JSON.parse(stored) } : freshState();
  } catch {
    return freshState();
  }
}

async function load<T>(file: string): Promise<T> {
  const response = await fetch(new URL('data/' + file, document.baseURI));
  if (!response.ok) throw new Error(file);
  return response.json();
}

@Injectable({ providedIn: 'root' })
export class DemoStore {
  private readonly router = inject(Router);
  private readonly stored = signal(readState());
  readonly state = this.stored.asReadonly();
  readonly offline = computed(() => this.state().offline);
  readonly started = computed(() => this.state().started);
  readonly routes = signal<Camino[]>([]);
  readonly lodgings = signal<Lodging[]>([]);
  readonly points = signal<Waypoint[]>([]);
  readonly notices = signal<Notice[]>([]);
  readonly dataError = signal(false);
  readonly trail = signal<{ id: string; line: TrailLine } | null>(null);
  readonly playing = signal(false);
  readonly speed = signal(1);
  readonly arrival = signal<string | null>(null);
  readonly mapLodging = signal<string | null>(null);
  readonly premiumOpen = signal(false);

  readonly route = computed(() => this.routes().find((item) => item.id === this.state().routeId));
  readonly stageIndex = computed(() => {
    let end = 0;
    const stages = this.route()?.stages ?? [];
    for (let index = 0; index < stages.length; index++) {
      end += stages[index].km;
      if (this.state().distance < end) return index;
    }
    return Math.max(0, stages.length - 1);
  });
  readonly stage = computed(() => this.route()?.stages[this.stageIndex()]);
  readonly stageStart = computed(
    () =>
      this.route()
        ?.stages.slice(0, this.stageIndex())
        .reduce((sum, stage) => sum + stage.km, 0) ?? 0,
  );
  readonly remaining = computed(() => Math.max(0, (this.route()?.km ?? 0) - this.state().distance));
  readonly stageRemaining = computed(() =>
    Math.max(0, this.stageStart() + (this.stage()?.km ?? 0) - this.state().distance),
  );
  readonly geometry = computed(() => {
    const trail = this.trail();
    const route = this.route();
    return trail && trail.id === route?.id
      ? trail.line.features.map((feature) => feature.geometry.coordinates)
      : (route?.stages.map((stage) => [stage.start, stage.end]) ?? []);
  });
  readonly stageGeometry = computed(() => {
    const line = this.geometry()[this.stageIndex()] ?? [];
    const distances = [0];
    for (let index = 1; index < line.length; index++) {
      distances.push(distances[index - 1] + kmBetween(line[index - 1], line[index]));
    }
    return { line, distances };
  });
  readonly progress = computed(() => {
    const { line, distances } = this.stageGeometry();
    const target = (distances.at(-1) ?? 0) * (1 - this.stageRemaining() / (this.stage()?.km || 1));
    const next = distances.findIndex((distance) => distance > target);
    if (next < 1) return { position: line.at(-1), partial: line };
    const ratio = (target - distances[next - 1]) / (distances[next] - distances[next - 1]);
    const [a, b] = [line[next - 1], line[next]];
    const position: Point = [a[0] + (b[0] - a[0]) * ratio, a[1] + (b[1] - a[1]) * ratio];
    return { position, partial: [...line.slice(0, next), position] };
  });
  readonly nearbyLodgings = computed(() => {
    const route = this.route();
    const stage = this.stage();
    if (!route || !stage) return [];
    return this.lodgings().filter(
      (item) =>
        item.routeId === route.id && (item.stageId === stage.id || item.stageId === stage.id + 1),
    );
  });
  readonly nearbyPoints = computed(() => {
    const stage = this.stage();
    return this.points().filter(
      (item) =>
        item.routeId === this.route()?.id &&
        (item.stageId === stage?.id || item.stageId === this.stageIndex()),
    );
  });
  readonly warnings = computed(() =>
    this.notices().filter((item) => item.routeId === this.route()?.id),
  );

  private readonly trails = new Map<string, Promise<TrailLine>>();
  private lastTick = 0;
  private saveTimer?: ReturnType<typeof setTimeout>;

  constructor() {
    void this.loadData();
    effect(() => {
      const state = this.state();
      clearTimeout(this.saveTimer);
      this.saveTimer = setTimeout(() => this.persist(state), 200);
    });
    effect((onCleanup) => {
      const id = this.route()?.id;
      if (!id) return;
      let active = true;
      onCleanup(() => {
        active = false;
      });
      const request = this.trails.get(id) ?? load<TrailLine>('tracados/' + id + '.geojson');
      this.trails.set(id, request);
      void request.then(
        (line) => {
          if (active) this.trail.set({ id, line });
        },
        () => {
          this.trails.delete(id);
        },
      );
    });

    const tick = setInterval(() => {
      const now = performance.now();
      if (this.playing() && this.lastTick) {
        const hours = Math.min(now - this.lastTick, 1000) / 3600000;
        this.move(this.state().distance + 4.5 * this.speed() * hours);
      }
      this.lastTick = now;
    }, 250);
    const flush = () => this.persist(this.state());
    window.addEventListener('pagehide', flush);
    inject(DestroyRef).onDestroy(() => {
      clearInterval(tick);
      clearTimeout(this.saveTimer);
      window.removeEventListener('pagehide', flush);
    });
  }

  async loadData(): Promise<void> {
    this.dataError.set(false);
    try {
      const [routes, lodgings, points, notices] = await Promise.all([
        load<Camino[]>('caminhos.json'),
        load<Lodging[]>('alojamentos.json'),
        load<Waypoint[]>('pontos.json'),
        load<Notice[]>('avisos.json'),
      ]);
      this.routes.set(routes);
      this.lodgings.set(lodgings);
      this.points.set(points);
      this.notices.set(notices);
    } catch {
      this.dataError.set(true);
    }
  }

  patch(update: Partial<DemoState>): void {
    this.stored.update((state) => ({ ...state, ...update }));
  }

  chooseRoute(id: string, started = true): void {
    const route = this.routes().find((item) => item.id === id);
    if (!route) return;
    this.playing.set(false);
    this.arrival.set(null);
    this.patch({ routeId: id, distance: 0, days: route.stages.length, started });
  }

  move(distance: number, announce = true): void {
    const route = this.route();
    if (!route || !Number.isFinite(distance)) return;
    const before = this.stageIndex();
    const next = Math.min(route.km, Math.max(0, distance));
    const atEnd = next === route.km && this.state().distance < route.km;
    this.patch({ distance: next });
    if (announce && (this.stageIndex() > before || atEnd)) {
      this.arrival.set(atEnd ? route.destination : (this.stage()?.from ?? null));
    }
    if (next === route.km) this.playing.set(false);
  }

  jumpTo(index: number): void {
    const stages = this.route()?.stages ?? [];
    if (!stages[index]) return;
    this.move(
      stages.slice(0, index).reduce((sum, stage) => sum + stage.km, 0),
      false,
    );
    this.arrival.set(index ? stages[index].from : null);
  }

  showLodging(id: string): void {
    const item = this.lodgings().find((lodging) => lodging.id === id);
    if (!item) return;
    if (item.routeId !== this.state().routeId) this.chooseRoute(item.routeId);
    this.jumpTo(item.stageId - 1);
    this.arrival.set(null);
    this.mapLodging.set(id);
    void this.router.navigateByUrl('/mapa');
  }

  reset(): void {
    this.playing.set(false);
    this.speed.set(1);
    this.arrival.set(null);
    this.mapLodging.set(null);
    this.premiumOpen.set(false);
    this.stored.set(freshState());
    try {
      localStorage.removeItem(storageKey);
    } catch {
      /* Storage is optional. */
    }
    void this.router.navigateByUrl('/mapa');
  }

  private persist(state: DemoState): void {
    try {
      localStorage.setItem(storageKey, JSON.stringify(state));
    } catch {
      /* Storage is optional. */
    }
  }
}
