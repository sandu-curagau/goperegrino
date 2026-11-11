import {
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import { IonIcon } from '@ionic/angular';
import { DemoStore } from '../demo/demo-store';
import { Locale, Message } from '../demo/locale';
import { lodgingPoint, Point, type Waypoint } from '../demo/models';
import { Sheet } from '../demo/sheet';
import { TrailMap } from './trail-map';
import { LodgingFlow } from './lodging-flow';
import { MapComment, TrailCommentFeed, TrailComments } from './trail-comments';
import { fetchStageWeather, sampleWeather, StageWeather } from './stage-weather';
import { StageForecast } from './stage-forecast';
import { LodgingSearch, LodgingSearchSheet } from './lodging-search';
import { PublicProfile } from './public-profile';
import { CommentTranslation } from './comment-translation';
import { walkingTime } from '../demo/walking-time';

type MapSheet = 'sos' | 'warnings' | 'lodgings' | 'detail' | 'comments' | 'weather' | 'profile';

@Component({
  imports: [
    IonIcon,
    Sheet,
    TrailMap,
    LodgingFlow,
    TrailComments,
    StageForecast,
    LodgingSearchSheet,
    PublicProfile,
  ],
  providers: [TrailCommentFeed, LodgingSearch, CommentTranslation],
  templateUrl: './map-page.html',
  styleUrls: [
    './map-page.scss',
    './map-view-switch.scss',
    './map-arrival.scss',
    './walking-navigation.scss',
  ],
})
export class MapPage {
  protected readonly store = inject(DemoStore);
  protected readonly locale = inject(Locale);
  protected readonly feed = inject(TrailCommentFeed);
  protected readonly stays = inject(LodgingSearch);
  private readonly router = inject(Router);
  protected readonly weather = signal(sampleWeather(1));
  private readonly refreshWeather = signal(0);
  protected readonly openSheet = signal<MapSheet | null>(null);
  protected readonly commentProfileOpen = signal(false);
  protected readonly popupProfileId = signal('');
  protected readonly warningDismissed = signal(false);
  private readonly stageKey = computed(() => this.store.route()?.id + ':' + this.store.stage()?.id);
  protected readonly warningTitle = computed(() => {
    const preview = this.store
      .warnings()
      .find((notice) => notice.type === 'route' || this.store.premium());
    return this.locale.t(preview ? this.warningKey(preview.id) : 'warnings');
  });
  protected readonly recenter = signal(0);
  protected readonly walkingView = signal(false);
  protected readonly following = signal(true);
  protected readonly eta = computed(() => walkingTime(this.store.walkingDayRemaining()));
  protected readonly navigationTitle = computed<Message>(
    () =>
      (
        ({
          left: 'turnLeft',
          right: 'turnRight',
          sharp: 'sharpTurn',
          straight: 'continueStraight',
          finish: 'arrivalAhead',
        }) as const
      )[this.store.navigation().kind],
  );
  protected readonly mapLoaded = signal<boolean | undefined>(undefined);
  protected readonly copied = signal(false);
  protected readonly link = signal('');
  protected readonly selectedId = signal<string | null>(null);
  protected readonly plannedArrival = signal<string | undefined>(undefined);
  protected readonly selectedCommentId = signal<string | null>(null);
  protected readonly activeComment = computed(() =>
    this.selectedCommentId()
      ? (this.feed.results().find((comment) => comment.id === this.selectedCommentId()) ??
        this.focusedComment())
      : undefined,
  );
  private readonly focusedComment = signal<MapComment | undefined>(undefined);
  protected readonly commentPins = computed(() => {
    const active = this.activeComment();
    const pins = this.feed.showPins() ? this.feed.results().slice(0, this.feed.mapLimit) : [];
    if (!active || pins.some((pin) => pin.id === active.id)) return pins;
    return [...pins.slice(0, this.feed.mapLimit - 1), active];
  });
  protected readonly target = signal<Point | undefined>(undefined);
  protected readonly nearbyPoint = signal<Waypoint | undefined>(undefined);
  protected readonly fitPoints = signal<Point[]>([]);
  protected readonly fitTop = signal(220);
  private readonly planOverview = signal(false);
  private readonly mapTop = viewChild<ElementRef<HTMLElement>>('mapTop');
  protected readonly pins = computed(() => {
    const items = this.stays.showPins() && !this.store.offline() ? this.stays.available() : [];
    const selected = this.selected();
    return selected && !items.some((item) => item.id === selected.id)
      ? [...items, selected]
      : items;
  });
  protected readonly stayHubs = computed(() =>
    this.planOverview() &&
    this.stays.showPins() &&
    !this.store.offline() &&
    this.stays.mode() === 'plan'
      ? this.stays.stops()
      : [],
  );
  protected readonly selected = computed(() =>
    this.selectedId()
      ? this.store.lodgings().find((item) => item.id === this.selectedId())
      : undefined,
  );
  protected readonly displayMap = computed(() => !this.store.offline() || !!this.store.premium());
  protected readonly roundedPosition = computed(() =>
    this.store
      .progress()
      .position?.map((value) => value.toFixed(5))
      .join(', '),
  );
  private readonly weatherCache = new Map<string, { data: StageWeather; expires: number }>();

  constructor() {
    effect(() => {
      if (this.store.walkClosed()) this.walkingView.set(false);
    });
    effect(() => {
      const point = this.store.mapNearbyPoint();
      if (!point) return;
      untracked(() => {
        this.clearSelection();
        this.walkingView.set(false);
        this.nearbyPoint.set(point);
        this.target.set(point.coordinates);
        this.openSheet.set(null);
      });
      this.store.mapNearbyPoint.set(null);
    });
    effect(() => {
      if (this.store.mapViewRequest() === 'walking') {
        untracked(() => this.setWalkingView(true));
        this.store.mapViewRequest.set(null);
      }
    });
    effect(() => {
      this.stageKey();
      this.warningDismissed.set(false);
    });
    effect(() => {
      if (this.feed.showPins()) this.feed.updateMapPosition();
    });
    effect(() => {
      this.store.cameraRevision();
      this.clearSelection();
      this.planOverview.set(false);
      this.fitPoints.set([]);
    });
    effect(() => {
      const id = this.store.mapLodging();
      if (!id) return;
      this.selectLodging(id);
      this.store.mapLodging.set(null);
    });
    effect(() => {
      const stageId = this.store.mapStayStop();
      if (stageId === null || !this.store.route()) return;
      untracked(() => this.showStayStop(stageId));
      this.store.mapStayStop.set(null);
    });
    effect(() => {
      if (this.store.offline() && this.openSheet() === 'lodgings') this.openSheet.set(null);
    });
    effect(() => {
      if (!this.store.started()) {
        this.stays.reset();
        this.walkingView.set(false);
        this.feed.showPins.set(false);
        this.feed.radius.set(1000);
        this.feed.sort.set('liked');
        this.clearSelection();
        this.openSheet.set(null);
      }
    });
    effect((onCleanup) => {
      const stage = this.store.walkingDay();
      const route = this.store.route();
      const offline = this.store.offline();
      this.refreshWeather();
      if (!stage || !route) return;
      const key = route.id + ':' + stage.stopId;
      const cached = this.weatherCache.get(key);
      const fresh = cached && cached.expires > Date.now();
      this.weather.set(fresh ? cached.data : sampleWeather(stage.stageId));
      if (offline || fresh || !this.store.started()) return;
      const controller = new AbortController();
      onCleanup(() => controller.abort());
      void this.loadWeather(stage.position, key, controller.signal);
    });
  }

  protected selectLodging(id: string): void {
    const item = this.store.lodgings().find((entry) => entry.id === id);
    if (!item) return;
    const planned =
      this.openSheet() === 'lodgings' && this.stays.mode() === 'plan'
        ? this.stays.stop()
        : undefined;
    this.clearSelection();
    this.walkingView.set(false);
    this.planOverview.set(false);
    this.selectedId.set(id);
    this.plannedArrival.set(planned?.date);
    this.target.set(lodgingPoint(item));
    this.store.arrival.set(null);
    this.openSheet.set(!this.displayMap() || this.mapLoaded() === false ? 'detail' : null);
  }

  protected clearSelection(): void {
    this.nearbyPoint.set(undefined);
    this.selectedId.set(null);
    this.plannedArrival.set(undefined);
    this.selectedCommentId.set(null);
    this.focusedComment.set(undefined);
    this.target.set(undefined);
  }

  protected showStays(nearby = false): void {
    if (this.store.offline()) return;
    this.store.arrival.set(null);
    if (nearby) this.stays.mode.set('nearby');
    this.stays.selectedStop.set(null);
    this.openSheet.set('lodgings');
  }

  protected showStayStop(stopId: number): void {
    if (this.store.offline() || !this.stays.stops().some((stop) => stop.stopId === stopId)) return;
    this.showStays();
    this.stays.mode.set('plan');
    this.stays.selectedStop.set(stopId);
  }

  protected showStaysOnMap(): void {
    this.clearSelection();
    this.walkingView.set(false);
    this.stays.showPins.set(true);
    const overview = this.stays.mode() === 'plan' && !this.stays.stop();
    this.planOverview.set(overview);
    const header = this.mapTop()?.nativeElement;
    if (header) this.fitTop.set(header.offsetTop + header.offsetHeight + (overview ? 48 : 22));
    this.fitPoints.set(this.stays.focusPoints());
    this.openSheet.set(null);
  }

  protected changeStayLayer(): void {
    this.planOverview.set(false);
    if (this.selectedId()) this.clearSelection();
  }

  protected openComments(): void {
    this.commentProfileOpen.set(false);
    this.feed.updatePosition();
    this.openSheet.set('comments');
  }

  protected openCommentProfile(id: string): void {
    this.popupProfileId.set(id);
    this.openSheet.set('profile');
  }

  protected navigationDistance(metres: number): string {
    return metres < 8
      ? this.locale.t('now')
      : metres < 1000
        ? this.locale.number(Math.max(10, Math.round(metres / 10) * 10)) + ' m'
        : this.locale.number(metres / 1000, 1) + ' km';
  }

  protected selectComment(comment: MapComment, center = false): void {
    this.clearSelection();
    this.focusedComment.set(comment);
    this.selectedCommentId.set(comment.id);
    if (!center) return;
    this.walkingView.set(false);
    this.target.set([...comment.position]);
    this.store.arrival.set(null);
    this.openSheet.set(null);
  }

  protected showForecast(): void {
    if (this.store.offline()) return;
    this.refreshWeather.update((version) => version + 1);
    this.openSheet.set('weather');
  }

  protected centerWalker(): void {
    this.clearSelection();
    this.planOverview.set(false);
    this.feed.updatePosition();
    this.recenter.update((value) => value + 1);
  }

  protected setWalkingView(enabled: boolean): void {
    this.walkingView.set(enabled);
    this.centerWalker();
  }

  protected finishAction(action: 'passport' | 'route'): void {
    this.store.completionOpen.set(false);
    if (action === 'route') this.store.planningAnother.set(true);
    else void this.router.navigateByUrl('/credencial');
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

  private async loadWeather(point: Point, key: string, signal: AbortSignal): Promise<void> {
    try {
      const data = await fetchStageWeather(point, signal);
      if (!data || signal.aborted) return;
      this.weatherCache.set(key, { data, expires: Date.now() + 15 * 60_000 });
      this.weather.set(data);
    } catch {
      // The deterministic forecast remains visible if the live request fails.
    }
  }
}
