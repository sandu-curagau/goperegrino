import { Component, computed, effect, inject, signal, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import { IonContent, IonIcon } from '@ionic/angular';
import { DemoStore } from '../demo/demo-store';
import { Locale, Message } from '../demo/locale';
import { kmBetween, lodgingPoint, type TrailPlaceKind, type Waypoint } from '../demo/models';
import {
  mapPlaceKind,
  placeLocation,
  placeTitle,
  trailPlaceKinds,
  trailPlaces,
} from './trail-places';
import { walkReservations } from '../demo/booking-plan';
import { walkingTime } from '../demo/walking-time';
import { Sheet } from '../demo/sheet';
import { loadOfflinePack } from './offline-map';
import { fetchStageWeather, sampleWeather } from './stage-weather';
import { StageForecast } from './stage-forecast';

type Section =
  'journal' | 'packing' | 'breaks' | 'download' | 'stopWalk' | 'anotherRoute' | 'resumeWalk';
type Action = Section | 'stampLog' | 'writeReviews';
const sections: { id: Action; icon: string; premium: boolean }[] = [
  { id: 'journal', icon: 'book-outline', premium: false },
  { id: 'stampLog', icon: 'ribbon-outline', premium: false },
  { id: 'breaks', icon: 'cafe-outline', premium: true },
  { id: 'writeReviews', icon: 'star-outline', premium: false },
  { id: 'packing', icon: 'bag-outline', premium: true },
  { id: 'download', icon: 'download-outline', premium: true },
];

const packingGroups = [
  { title: 'packClothing', items: ['packShoes', 'packSocks', 'packRain', 'packHat', 'packLayers'] },
  {
    title: 'packCare',
    items: ['packWater', 'packFood', 'packKit', 'packBlisters', 'packSunscreen', 'packToiletries'],
  },
  {
    title: 'packTravel',
    items: [
      'packPassport',
      'packId',
      'packCash',
      'packBattery',
      'packCharger',
      'packLight',
      'packCover',
      'packTowel',
      'packLiner',
    ],
  },
] as const satisfies readonly { title: Message; items: readonly Message[] }[];

@Component({
  imports: [IonContent, IonIcon, Sheet, StageForecast],
  templateUrl: './current-walk-page.html',
  styleUrls: ['./current-walk-page.scss', './walk-tools.scss'],
})
export class CurrentWalkPage {
  protected readonly store = inject(DemoStore);
  protected readonly locale = inject(Locale);
  private readonly router = inject(Router);
  private readonly content = viewChild(IonContent);
  protected readonly availableSections = computed(() =>
    this.store.walkInProgress()
      ? sections
      : sections.filter(({ id }) => id === 'journal' || id === 'stampLog' || id === 'writeReviews'),
  );
  protected readonly packingGroups = packingGroups;
  protected readonly items = packingGroups.flatMap(({ items }) => [...items]);
  protected readonly packed = computed(
    () => this.items.filter((item) => this.store.state().pack.includes(item)).length,
  );
  protected readonly trailPlaces = trailPlaces;
  protected readonly placeLocation = placeLocation;
  protected readonly placeTitle = placeTitle;
  protected readonly nearbyKinds = trailPlaceKinds;
  protected readonly nearbyFilter = signal<TrailPlaceKind | 'all'>('all');
  protected readonly nearbyRadius = signal(5);
  protected readonly nearbyLimit = signal(12);
  protected readonly increaseLimit = (limit: number) => limit + 12;
  protected readonly section = signal<Section | null>(null);
  protected readonly notice = signal<Message | null>(null);
  protected readonly downloading = signal(false);
  protected readonly weatherOpen = signal(false);
  protected readonly weather = signal(sampleWeather(1));
  protected readonly eta = computed(() => walkingTime(this.store.walkingDayRemaining()));
  protected readonly dayProgress = computed(() => {
    const previous = this.store.walkingPlan()[this.store.walkingDayIndex() - 1];
    return Math.max(
      0,
      Math.min(
        this.store.walkingDay()?.km ?? 0,
        this.store.state().distance - (previous?.distance ?? 0),
      ),
    );
  });
  protected readonly stay = computed(() => {
    const route = this.store.route();
    const day = this.store.walkingDay();
    if (!route || !day) return undefined;
    return walkReservations(
      route,
      this.store.walkingPlan(),
      this.store.state().reservations,
      this.store.lodgings(),
      this.store.state().walkId,
    ).find(
      ({ booking, place }) =>
        booking.arrival <= day.date &&
        booking.departure > day.date &&
        kmBetween(day.position, lodgingPoint(place)) <= 5,
    );
  });

  constructor() {
    effect(() => {
      if (this.store.walkClosed()) void this.content()?.scrollToTop();
    });
    effect((onCleanup) => {
      const day = this.store.walkingDay();
      const offline = this.store.offline();
      if (!day) return;
      this.weather.set(sampleWeather(day.stageId));
      if (offline) return;
      const controller = new AbortController();
      onCleanup(() => controller.abort());
      void fetchStageWeather(day.position, controller.signal)
        .then((weather) => {
          if (weather && !controller.signal.aborted) this.weather.set(weather);
        })
        .catch(() => {});
    });
  }

  protected continueWalk(): void {
    this.store.openWalkingMap();
  }

  protected findStay(): void {
    const day = this.store.walkingDay();
    if (day && !this.store.offline()) this.store.showStayStop(day.stopId);
  }

  protected viewReservation(code: string): void {
    void this.router.navigate(['/reservas'], {
      queryParams: { route: this.store.route()?.id, booking: code },
    });
  }

  protected readonly downloaded = computed(() => this.store.state().offlineDownloaded);
  protected readonly nearbyServices = computed(() => {
    const position = this.store.progress().position;
    const routeId = this.store.route()?.id;
    if (!position || !routeId) return [];
    const kind = this.nearbyFilter();
    return this.store
      .points()
      .filter(
        (point) => point.routeId === routeId && (kind === 'all' || mapPlaceKind(point) === kind),
      )
      .map((point) => ({
        ...point,
        mapKind: mapPlaceKind(point),
        km: kmBetween(position, point.coordinates),
      }))
      .filter((point) => point.km <= this.nearbyRadius())
      .sort((a, b) => a.km - b.km);
  });
  protected open(section: Action, premium = false): void {
    if (premium && !this.store.premium()) {
      this.store.premiumOpen.set(true);
      return;
    }
    if (section === 'journal') {
      void this.router.navigateByUrl('/diario?walk=current');
      return;
    }
    if (section === 'stampLog') {
      this.credential();
      return;
    }
    if (section === 'writeReviews') {
      this.reviewBookings();
      return;
    }
    this.notice.set(null);
    if (section === 'breaks') this.nearbyLimit.set(12);
    this.section.set(section);
  }

  protected anotherWalk(): void {
    if (!this.store.walkClosed()) {
      this.section.set('anotherRoute');
      return;
    }
    this.planAnother();
  }

  protected planAnother(): void {
    this.close();
    this.store.playing.set(false);
    this.store.planningAnother.set(true);
  }

  protected stopWalk(): void {
    this.store.stopWalk();
    this.close();
  }

  protected resumeWalk(): void {
    this.close();
    this.store.resumeWalk(this.store.state().walkId);
  }

  protected showNearbyPoint(point: Waypoint): void {
    this.close();
    this.store.showNearbyPoint(point);
  }

  protected close(): void {
    this.section.set(null);
  }

  protected pack(item: Message, checked: boolean): void {
    const pack = this.store.state().pack.filter((entry) => entry !== item);
    this.store.patch({ pack: checked ? [...pack, item] : pack });
  }

  protected credential(): void {
    void this.router.navigateByUrl('/credencial');
  }

  protected reviewBookings(): void {
    void this.router.navigate(['/reservas'], { queryParams: { route: this.store.route()?.id } });
  }

  protected async download(): Promise<void> {
    if (this.store.offline() || this.downloading() || this.downloaded()) return;
    this.notice.set(null);
    this.downloading.set(true);
    try {
      await loadOfflinePack();
      this.store.patch({ offlineDownloaded: true });
    } catch {
      this.notice.set('downloadError');
    } finally {
      this.downloading.set(false);
    }
  }
}
