import { Component, computed, inject, Injectable, input, output, signal } from '@angular/core';
import { IonIcon } from '@ionic/angular';
import { DemoStore } from '../demo/demo-store';
import { itinerary } from '../demo/itinerary';
import { Locale } from '../demo/locale';
import { distanceToLodging, Lodging, lodgingPoint, Point } from '../demo/models';
import { Sheet } from '../demo/sheet';

export type PlannedStop = ReturnType<typeof itinerary>[number];
export const nearbyRadius = 5;
const defaultFilters = { price: 90, laundry: false, pets: false };

function byDistance(items: Lodging[], position: Point) {
  return items
    .map((item) => ({ item, distance: distanceToLodging(position, item) ?? Infinity }))
    .sort((a, b) => a.distance - b.distance);
}

@Injectable()
export class LodgingSearch {
  private readonly store = inject(DemoStore);
  readonly mode = signal<'plan' | 'nearby'>('plan');
  readonly showPins = signal(true);
  readonly selectedStop = signal<number | null>(null);
  readonly filters = signal(defaultFilters);
  private readonly catalog = computed(() =>
    this.store.lodgings().filter((item) => item.routeId === this.store.route()?.id),
  );
  readonly available = computed(() => {
    const filters = this.filters();
    return this.catalog().filter(
      (item) =>
        !this.store.premium() ||
        (item.price <= filters.price &&
          (!filters.laundry || item.facilities.includes('laundry')) &&
          (!filters.pets || item.facilities.includes('pets'))),
    );
  });
  readonly stops = computed(() => {
    const available = this.available();
    return this.store.walkingPlan().map((stop) => ({
      ...stop,
      stays: byDistance(
        available.filter(
          (item) => (distanceToLodging(stop.position, item) ?? Infinity) <= nearbyRadius,
        ),
        stop.position,
      ),
    }));
  });
  readonly stop = computed(() => this.stops().find((stop) => stop.stopId === this.selectedStop()));
  readonly nearest = computed(() => {
    const position = this.store.progress().position;
    return position ? byDistance(this.available(), position) : [];
  });
  readonly nearby = computed(() =>
    this.nearest().filter((entry) => entry.distance <= nearbyRadius),
  );
  readonly results = computed(() =>
    this.mode() === 'plan'
      ? (this.stop()?.stays ?? [])
      : this.nearby().length
        ? this.nearby()
        : this.nearest().slice(0, 3),
  );

  focusPoints(): Point[] {
    if (this.mode() === 'plan') {
      const stop = this.stop();
      return stop
        ? [stop.position, ...stop.stays.map(({ item }) => lodgingPoint(item))]
        : this.stops().map((entry) => entry.position);
    }
    const position = this.store.progress().position;
    return [
      ...(position ? [position] : []),
      ...this.results().map(({ item }) => lodgingPoint(item)),
    ];
  }

  reset(): void {
    this.mode.set('plan');
    this.showPins.set(true);
    this.selectedStop.set(null);
    this.filters.set(defaultFilters);
  }
}

@Component({
  selector: 'app-lodging-search',
  imports: [IonIcon, Sheet],
  templateUrl: './lodging-search.html',
  styleUrl: './lodging-search.scss',
})
export class LodgingSearchSheet {
  protected readonly search = inject(LodgingSearch);
  protected readonly store = inject(DemoStore);
  protected readonly locale = inject(Locale);
  protected readonly radius = nearbyRadius;
  protected readonly showFilters = signal(false);
  readonly mapAvailable = input(true);
  readonly closed = output<void>();
  readonly selected = output<string>();
  readonly layerChanged = output<void>();
  readonly showMap = output<void>();

  protected changeMode(mode: 'plan' | 'nearby'): void {
    this.search.mode.set(mode);
    this.search.selectedStop.set(null);
    this.layerChanged.emit();
  }

  protected togglePins(): void {
    this.search.showPins.update((visible) => !visible);
    this.layerChanged.emit();
  }

  protected filter(): void {
    if (this.store.premium()) this.showFilters.update((open) => !open);
    else {
      this.closed.emit();
      this.store.premiumOpen.set(true);
    }
  }

  protected propertyLocation(item: Lodging): string {
    return item.location.address.split(' · ')[0];
  }
}
