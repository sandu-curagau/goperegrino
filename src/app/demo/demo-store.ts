import { computed, DestroyRef, effect, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { itinerary } from './itinerary';
import { joinStages } from './trail-geometry';
import { bookingConflicts, walkReservations } from './booking-plan';
import { walkingTrack, trackDistance, walkingInstruction } from './walking-guidance';
import {
  Camino,
  PaymentCard,
  PilgrimProfile,
  dateInput,
  Lodging,
  JournalEntry,
  Notice,
  Point,
  Reservation,
  Stamp,
  TrailLine,
  TrailComment,
  TrailPlaceKind,
  WalkRecord,
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
  ['zh', '简体中文'],
] as const;
export type Language = (typeof languages)[number][0];

interface DemoState {
  profile: PilgrimProfile;
  language: Language;
  theme: 'system' | 'light' | 'dark';
  mapPlaceKinds: TrailPlaceKind[];
  routeId: string;
  started: boolean;
  date: string;
  days: number;
  distance: number;
  walkId: string;
  walkAttempt: number;
  walkHistory: WalkRecord[];
  walkStopped: boolean;
  trailComments: TrailComment[];
  likedTrailComments: string[];
  premium: 0 | 7 | 30;
  premiumPurchased: boolean;
  offline: boolean;
  offlineDownloaded: boolean;
  reservations: Reservation[];
  stamps: Stamp[];
  trustedContact: string;
  notes: Record<string, string>;
  pack: string[];
  suggestions: string[];
  reviews: Record<string, { score: number; text: string }>;
  paymentCards: PaymentCard[];
  defaultPaymentCard: string;
}

const storageKey = 'goperegrino-demo-v1';
const journalStorageKey = 'goperegrino-journal-v1';
function freshState(): DemoState {
  return {
    profile: {
      name: 'Alex',
      bio: '',
      photo: '',
      color: 'ocean',
      featuredAchievements: ['finisher', 'distance', 'journal'],
    },
    language: 'pt',
    theme: 'system',
    mapPlaceKinds: ['water', 'cafe', 'restaurant', 'market', 'picnic'],
    routeId: 'central',
    started: false,
    date: dateInput(),
    days: 11,
    distance: 0,
    walkId: '',
    walkAttempt: 0,
    walkHistory: [],
    walkStopped: false,
    trailComments: [],
    likedTrailComments: [],
    premium: 0,
    premiumPurchased: false,
    offline: false,
    offlineDownloaded: false,
    reservations: [],
    stamps: [],
    trustedContact: '',
    notes: {},
    pack: [],
    suggestions: [],
    reviews: {},
    paymentCards: [
      { id: 'demo-visa', brand: 'Visa', last4: '4242', expiry: '12/30', nickname: '' },
    ],
    defaultPaymentCard: 'demo-visa',
  };
}

function readState(): DemoState {
  try {
    const stored = localStorage.getItem(storageKey);
    const state: DemoState = stored ? { ...freshState(), ...JSON.parse(stored) } : freshState();
    // Existing Premium holders have already used their first-purchase eligibility.
    if (state.premium) state.premiumPurchased = true;
    if (state.started && !state.walkId) state.walkId = 'legacy-' + state.routeId;
    const attempts = new Map<string, number>();
    state.walkHistory = [...state.walkHistory]
      .reverse()
      .map((walk) => {
        const previous = attempts.get(walk.routeId) ?? 0;
        const attempt = walk.attempt ?? previous + 1;
        attempts.set(walk.routeId, Math.max(previous, attempt));
        return { ...walk, attempt };
      })
      .reverse();
    if (state.started && !state.walkAttempt)
      state.walkAttempt = (attempts.get(state.routeId) ?? 0) + 1;
    return state;
  } catch {
    return freshState();
  }
}

function readJournal(): JournalEntry[] {
  try {
    const entries = JSON.parse(localStorage.getItem(journalStorageKey) ?? '[]');
    return Array.isArray(entries) ? entries : [];
  } catch {
    return [];
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
  private readonly journalEntries = signal(readJournal());
  readonly state = this.stored.asReadonly();
  readonly journal = this.journalEntries.asReadonly();
  readonly activeWalk = computed<WalkRecord | null>(() => {
    const { started, walkId, walkAttempt, routeId, date, days, distance, walkStopped, pack } =
      this.state();
    return started
      ? {
          id: walkId,
          routeId,
          date,
          days,
          distance,
          attempt: walkAttempt,
          pack,
          status: this.completed() ? 'completed' : walkStopped ? 'stopped' : undefined,
        }
      : null;
  });
  private readonly connected = signal(navigator.onLine);
  readonly offline = computed(() => this.state().offline || !this.connected());
  readonly started = computed(() => this.state().started);
  readonly premium = computed(() => this.state().premium);
  readonly routes = signal<Camino[]>([]);
  readonly lodgings = signal<Lodging[]>([]);
  readonly points = signal<Waypoint[]>([]);
  readonly notices = signal<Notice[]>([]);
  readonly dataError = signal(false);
  readonly trail = signal<{ id: string; line: TrailLine } | null>(null);
  readonly playing = signal(false);
  readonly speed = signal(1);
  readonly arrival = signal<string | null>(null);
  readonly planningAnother = signal(false);
  readonly cameraRevision = signal(0);
  readonly mapLodging = signal<string | null>(null);
  readonly mapNearbyPoint = signal<Waypoint | null>(null);
  readonly premiumOpen = signal(false);

  readonly route = computed(() => this.routes().find((item) => item.id === this.state().routeId));
  private readonly plannedDays = computed(() => this.state().days);
  private readonly departureDate = computed(() => this.state().date);
  readonly walkingPlan = computed(() => {
    const route = this.route();
    return route ? itinerary(route, this.plannedDays(), this.departureDate()) : [];
  });
  readonly walkingDayIndex = computed(() => {
    const plan = this.walkingPlan();
    const next = plan.findIndex((day) => this.state().distance < day.distance);
    return next < 0 ? Math.max(0, plan.length - 1) : next;
  });
  readonly walkingDay = computed(() => this.walkingPlan()[this.walkingDayIndex()]);
  readonly walkingDayRemaining = computed(() =>
    Math.max(0, (this.walkingDay()?.distance ?? 0) - this.state().distance),
  );
  readonly mapStayStop = signal<number | null>(null);
  readonly mapViewRequest = signal<'walking' | null>(null);
  readonly bookingPlanConflicts = computed(() => {
    const route = this.route();
    return route
      ? bookingConflicts(
          route,
          this.walkingPlan(),
          this.state().reservations,
          this.lodgings(),
          this.state().walkId,
        )
      : [];
  });
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
  readonly completed = computed(() => !!this.route() && this.started() && this.remaining() === 0);
  readonly walkClosed = computed(() => this.state().walkStopped || this.completed());
  readonly walkInProgress = computed(() => this.started() && !this.walkClosed());
  readonly stageRemaining = computed(() =>
    Math.max(0, this.stageStart() + (this.stage()?.km ?? 0) - this.state().distance),
  );
  readonly geometry = computed(() => {
    const trail = this.trail();
    const route = this.route();
    return trail && trail.id === route?.id
      ? joinStages(trail.line.features.map((feature) => feature.geometry.coordinates))
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
  private readonly navigationTrack = computed(() => walkingTrack(this.geometry()));
  readonly navigation = computed(() => {
    const route = this.route();
    const track = this.navigationTrack();
    return walkingInstruction(
      track,
      route ? trackDistance(route, track, this.state().distance) : 0,
      route ? trackDistance(route, track, this.walkingDay()?.distance ?? route.km) : 0,
    );
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
  readonly nearbyPoints = computed(() => {
    const stage = this.stage();
    return this.points().filter(
      (item) =>
        item.routeId === this.route()?.id &&
        (item.stageId === stage?.id || item.stageId === this.stageIndex()),
    );
  });
  readonly warnings = computed(() => {
    const route = this.route();
    const stage = this.stage();
    if (!route || !stage || this.walkClosed()) return [];
    return this.notices().filter((item) => item.routeId === route.id && item.stageId === stage.id);
  });

  private readonly trails = new Map<string, Promise<TrailLine>>();
  private lastTick = 0;
  private saveTimer?: ReturnType<typeof setTimeout>;

  constructor() {
    this.migrateNotes();
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
    const connectionChanged = () => this.connected.set(navigator.onLine);
    window.addEventListener('pagehide', flush);
    window.addEventListener('online', connectionChanged);
    window.addEventListener('offline', connectionChanged);
    inject(DestroyRef).onDestroy(() => {
      clearInterval(tick);
      clearTimeout(this.saveTimer);
      window.removeEventListener('pagehide', flush);
      window.removeEventListener('online', connectionChanged);
      window.removeEventListener('offline', connectionChanged);
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

  updateWalkingPlan(date: string, days: number): void {
    const route = this.route();
    if (!route) return;
    const ids = new Set(
      walkReservations(
        route,
        this.walkingPlan(),
        this.state().reservations,
        this.lodgings(),
        this.state().walkId,
      ).map(({ booking }) => booking.code),
    );
    this.patch({
      date,
      days,
      reservations: this.state().reservations.map((booking) =>
        ids.has(booking.code) && !booking.walkId
          ? { ...booking, walkId: this.state().walkId }
          : booking,
      ),
    });
  }

  openWalkingMap(): void {
    if (this.walkClosed() || !this.started()) return;
    void this.router.navigateByUrl('/mapa');
    this.mapViewRequest.set('walking');
  }

  chooseRoute(id: string, started = true): void {
    const route = this.routes().find((item) => item.id === id);
    if (!route) return;
    const walkHistory = this.archiveCurrent();
    const previousAttempts = walkHistory.filter((walk) => walk.routeId === id);
    const walkAttempt =
      Math.max(previousAttempts.length, ...previousAttempts.map((walk) => walk.attempt ?? 0)) + 1;
    this.resetWalkView();
    this.patch({
      routeId: id,
      distance: 0,
      days: route.stages.length,
      started,
      walkId: started ? crypto.randomUUID() : '',
      walkAttempt: started ? walkAttempt : 0,
      walkStopped: false,
      pack: [],
      walkHistory,
    });
    this.cameraRevision.update((revision) => revision + 1);
  }

  stopWalk(): void {
    if (!this.started() || this.walkClosed()) return;
    this.playing.set(false);
    this.arrival.set(null);
    this.patch({ walkStopped: true });
  }

  resumeWalk(id: string): void {
    const current = this.activeWalk();
    const walk =
      current?.id === id ? current : this.state().walkHistory.find((entry) => entry.id === id);
    const route = this.routes().find((entry) => entry.id === walk?.routeId);
    if (!walk || !route || walk.status === 'completed' || walk.distance >= route.km || !walk.days)
      return;
    if (current?.id === id && !this.state().walkStopped) return;
    this.resetWalkView();
    if (current?.id === id) {
      this.patch({ walkStopped: false });
    } else {
      this.patch({
        routeId: walk.routeId,
        date: walk.date,
        days: walk.days,
        distance: walk.distance,
        walkId: walk.id,
        walkAttempt: walk.attempt ?? 1,
        started: true,
        walkStopped: false,
        pack: walk.pack ?? [],
        walkHistory: this.archiveCurrent().filter((entry) => entry.id !== id),
      });
    }
    this.cameraRevision.update((revision) => revision + 1);
    this.openWalkingMap();
  }

  private archiveCurrent(): WalkRecord[] {
    const current = this.activeWalk();
    const history = this.state().walkHistory;
    return current
      ? [
          { ...current, status: current.status ?? 'stopped' },
          ...history.filter((entry) => entry.id !== current.id),
        ]
      : history;
  }

  private resetWalkView(): void {
    this.playing.set(false);
    this.arrival.set(null);
  }

  saveJournalEntry(entry: JournalEntry): boolean {
    const entries = this.journal().filter(
      (item) =>
        item.walkId !== entry.walkId ||
        (entry.id ? item.id !== entry.id : !!item.id || item.date !== entry.date),
    );
    if (entry.note || entry.photos.length) entries.push(entry);
    return this.persistJournal(entries);
  }

  addTrailComment(comment: Omit<TrailComment, 'id' | 'createdAt'>): void {
    const entry = { ...comment, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
    this.patch({ trailComments: [...this.state().trailComments, entry] });
  }

  toggleTrailCommentLike(id: string): void {
    const likes = this.state().likedTrailComments;
    this.patch({
      likedTrailComments: likes.includes(id) ? likes.filter((like) => like !== id) : [...likes, id],
    });
  }

  move(distance: number, announce = true): void {
    const route = this.route();
    if (!route || !Number.isFinite(distance) || this.walkClosed()) return;
    const before = this.walkingDayIndex();
    const next = Math.min(route.km, Math.max(0, distance));
    const atEnd = next === route.km && this.state().distance < route.km;
    this.patch({ distance: next });
    if (atEnd) {
      this.arrival.set(null);
      if (announce) void this.router.navigateByUrl('/caminho', { replaceUrl: true });
    } else if (announce && this.walkingDayIndex() > before) {
      this.arrival.set(this.walkingDay()?.from ?? null);
    }
    if (next === route.km) this.playing.set(false);
  }

  seek(distance: number): void {
    this.move(distance);
    this.cameraRevision.update((revision) => revision + 1);
  }

  jumpTo(index: number): void {
    const plan = this.walkingPlan();
    if (!plan[index] || this.walkClosed()) return;
    this.move(plan[index - 1]?.distance ?? 0, false);
    this.arrival.set(index ? plan[index].from : null);
    this.cameraRevision.update((revision) => revision + 1);
  }

  showLodging(id: string): void {
    if (!this.walkInProgress()) return;
    const item = this.lodgings().find((lodging) => lodging.id === id);
    if (!item) return;
    this.arrival.set(null);
    this.mapLodging.set(id);
    void this.router.navigateByUrl('/mapa');
  }

  showStayStop(stageId: number): void {
    void this.router.navigateByUrl('/mapa').then((opened) => {
      if (opened) this.mapStayStop.set(stageId);
    });
  }

  showNearbyPoint(point: Waypoint): void {
    void this.router.navigateByUrl('/mapa').then((opened) => {
      if (opened) this.mapNearbyPoint.set(point);
    });
  }

  reset(): void {
    this.playing.set(false);
    this.speed.set(1);
    this.arrival.set(null);
    this.planningAnother.set(false);
    this.cameraRevision.update((revision) => revision + 1);
    this.mapLodging.set(null);
    this.mapNearbyPoint.set(null);
    this.mapStayStop.set(null);
    this.mapViewRequest.set(null);
    this.premiumOpen.set(false);
    this.stored.set(freshState());
    this.journalEntries.set([]);
    try {
      localStorage.removeItem(storageKey);
      localStorage.removeItem(journalStorageKey);
    } catch {
      /* Storage is optional. */
    }
    void this.router.navigateByUrl('/mapa');
  }

  private migrateNotes(): void {
    const state = this.state();
    if (!Object.keys(state.notes).length) return;
    const entries = [...this.journal()];
    const recovered = new Map<string, WalkRecord>();
    for (const [key, note] of Object.entries(state.notes).sort()) {
      const [routeId, date] = key.split(':');
      if (!note || !/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
      const current = state.started && routeId === state.routeId;
      const walkId = current ? state.walkId : 'legacy-' + routeId;
      if (!current && !recovered.has(walkId))
        recovered.set(walkId, { id: walkId, routeId, date, days: 0, distance: 0 });
      if (!entries.some((entry) => entry.walkId === walkId && entry.date === date)) {
        entries.push({ walkId, date, note, photos: [] });
      }
    }
    if (this.persistJournal(entries)) {
      const history = state.walkHistory.concat(
        [...recovered.values()].filter(
          (walk) => !state.walkHistory.some((item) => item.id === walk.id),
        ),
      );
      this.patch({ notes: {}, walkHistory: history });
      this.persist(this.state());
    }
  }

  private persistJournal(entries: JournalEntry[]): boolean {
    try {
      localStorage.setItem(journalStorageKey, JSON.stringify(entries));
      this.journalEntries.set(entries);
      return true;
    } catch {
      return false;
    }
  }

  private persist(state: DemoState): void {
    try {
      localStorage.setItem(storageKey, JSON.stringify(state));
    } catch {
      /* Storage is optional. */
    }
  }
}
