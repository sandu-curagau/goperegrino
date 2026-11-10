import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { IonIcon } from '@ionic/angular';
import { DemoStore, languages } from './demo-store';
import { Locale, Message } from './locale';
import { itinerary } from './itinerary';
import { Camino, dateInput } from './models';

const slides: { title: Message; text: Message; icon: string }[] = [
  { title: 'learn1', text: 'learn1Text', icon: 'map-outline' },
  { title: 'learn2', text: 'learn2Text', icon: 'bed-outline' },
  { title: 'learn3', text: 'learn3Text', icon: 'shield-checkmark-outline' },
];

@Component({
  selector: 'app-onboarding',
  imports: [IonIcon],
  templateUrl: './onboarding.html',
  styleUrl: './onboarding.scss',
})
export class Onboarding {
  protected readonly store = inject(DemoStore);
  protected readonly locale = inject(Locale);
  private readonly router = inject(Router);
  protected readonly languages = languages;
  protected readonly slides = slides;
  protected readonly step = signal(0);
  protected readonly selected = signal<Camino | undefined>(undefined);
  protected readonly startDate = signal(dateInput());
  protected readonly days = signal(1);
  protected readonly today = dateInput();
  protected readonly plan = computed(() => {
    const route = this.selected();
    return route ? itinerary(route, this.days(), this.startDate() || this.today) : [];
  });

  protected choose(route: Camino): void {
    this.selected.set(route);
    this.days.set(route.stages.length);
    this.step.set(5);
  }

  protected begin(): void {
    const route = this.selected();
    if (!route) return;
    this.store.chooseRoute(route.id);
    this.store.patch({ date: this.startDate() || this.today, days: this.days() });
    void this.router.navigateByUrl('/mapa');
  }

  protected shape(route: Camino): string {
    const stops = [route.stages[0].start, ...route.stages.map((stage) => stage.end)];
    const west = Math.min(...stops.map(([lon]) => lon));
    const east = Math.max(...stops.map(([lon]) => lon));
    const south = Math.min(...stops.map(([, lat]) => lat));
    const north = Math.max(...stops.map(([, lat]) => lat));
    return stops
      .map(([lon, lat]) =>
        [
          8 + ((lon - west) / (east - west || 1)) * 48,
          48 - ((lat - south) / (north - south || 1)) * 38,
        ].join(','),
      )
      .join(' ');
  }
}
