import { Component, computed, inject, input, output, signal } from '@angular/core';
import { IonIcon } from '@ionic/angular';
import { Locale, type Message } from '../demo/locale';
import { DemoStore } from '../demo/demo-store';
import { kmBetween, type Waypoint } from '../demo/models';
import { Sheet } from '../demo/sheet';
import {
  mapPlaceKind,
  placeDescription,
  placeLocation,
  placeTitle,
  trailPlaces,
} from './trail-places';

@Component({
  selector: 'app-place-details',
  imports: [Sheet, IonIcon],
  templateUrl: './place-details.html',
  styleUrl: './place-details.scss',
})
export class PlaceDetails {
  readonly point = input.required<Waypoint>();
  readonly closed = output<void>();
  protected readonly locale = inject(Locale);
  private readonly store = inject(DemoStore);
  protected readonly title = computed(() => placeTitle(this.point(), this.locale));
  protected readonly location = computed(() => placeLocation(this.point(), this.locale));
  protected readonly description = computed(() => placeDescription(this.point(), this.locale));
  protected readonly category = computed(() => trailPlaces[mapPlaceKind(this.point())]);
  protected readonly photos = computed(() => this.point().photos ?? []);
  protected readonly photo = signal(0);
  protected readonly photoFailed = signal(false);
  protected readonly distance = computed(() => {
    const position = this.store.progress().position;
    if (!position) return '';
    const km = kmBetween(position, this.point().coordinates);
    const value = km < 1 ? this.locale.number(km * 1000) + ' m' : this.locale.number(km, 1) + ' km';
    return this.locale.t('placeDistance', { distance: value });
  });
  protected readonly dayLabels: Record<'daily' | 'weekdays' | 'monSat', Message> = {
    daily: 'placeDaily',
    weekdays: 'placeWeekdays',
    monSat: 'placeMonSat',
  };

  protected advance(step: number): void {
    this.photo.update((index) => (index + step + this.photos().length) % this.photos().length);
    this.photoFailed.set(false);
  }
}
