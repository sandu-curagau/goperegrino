import { Component, computed, inject, signal } from '@angular/core';
import { IonContent, IonIcon } from '@ionic/angular';
import { DemoStore, languages } from '../demo/demo-store';
import { itinerary } from '../demo/itinerary';
import { Locale, Message } from '../demo/locale';
import { lodgingPoint, kmBetween } from '../demo/models';
import { Sheet } from '../demo/sheet';
import { loadOfflinePack } from './offline-map';

type Section =
  'trusted' | 'journal' | 'packing' | 'breaks' | 'writeReviews' | 'download' | 'suggest' | 'about';
const premiumSections: { id: Section; icon: string }[] = [
  { id: 'download', icon: 'download-outline' },
  { id: 'journal', icon: 'book-outline' },
  { id: 'packing', icon: 'bag-outline' },
  { id: 'breaks', icon: 'cafe-outline' },
  { id: 'writeReviews', icon: 'star-outline' },
];

@Component({
  imports: [IonContent, IonIcon, Sheet],
  templateUrl: './profile-page.html',
  styleUrl: './profile-page.scss',
})
export class ProfilePage {
  protected readonly store = inject(DemoStore);
  protected readonly locale = inject(Locale);
  protected readonly languages = languages;
  protected readonly premiumSections = premiumSections;
  protected readonly items: Message[] = [
    'packWater',
    'packShoes',
    'packRain',
    'packKit',
    'packPassport',
    'packBattery',
  ];
  protected readonly section = signal<Section | null>(null);
  protected readonly notice = signal<Message | null>(null);
  protected readonly downloading = signal(false);

  protected readonly downloaded = computed(() => this.store.state().offlineDownloaded);
  protected readonly walks = computed(() => {
    const route = this.store.route();
    const { days, date, distance } = this.store.state();
    if (!route) return [];
    let start = 0;
    return itinerary(route, days, date).map((day) => {
      const walked = Math.min(day.km, Math.max(0, distance - start));
      start += day.km;
      return { ...day, walked };
    });
  });
  protected readonly currentDay = computed(
    () => this.walks().find((day) => day.walked < day.km) ?? this.walks().at(-1),
  );
  protected readonly journalKey = computed(
    () => this.store.state().routeId + ':' + this.currentDay()?.date,
  );
  protected readonly pauseSpots = computed(() => {
    const position = this.store.progress().position;
    if (!position) return [];
    return this.store
      .nearbyPoints()
      .filter((point) => point.kind === 'water' || point.kind === 'cafe')
      .map((point) => ({ ...point, km: kmBetween(position, point.coordinates) }))
      .sort((a, b) => a.km - b.km)
      .slice(0, 4);
  });
  protected readonly reviewPlaces = computed(() => {
    const booked = new Set(this.store.state().reservations.map((booking) => booking.lodgingId));
    return this.store
      .lodgings()
      .filter((place) => booked.has(place.id))
      .concat(this.store.nearbyLodgings().filter((place) => !booked.has(place.id)));
  });
  protected readonly reviewId = signal('');

  protected open(section: Section, premium = false): void {
    if (premium && !this.store.premium()) {
      this.store.premiumOpen.set(true);
      return;
    }
    this.notice.set(null);
    if (section === 'writeReviews') this.reviewId.set(this.reviewPlaces()[0]?.id ?? '');
    this.section.set(section);
  }

  protected close(): void {
    this.section.set(null);
  }

  protected saveContact(value: string): void {
    this.store.patch({ trustedContact: value.trim() });
    this.notice.set('saved');
  }

  protected saveNote(note: string): void {
    this.store.patch({ notes: { ...this.store.state().notes, [this.journalKey()]: note.trim() } });
    this.notice.set('saved');
  }

  protected pack(item: Message, checked: boolean): void {
    const pack = this.store.state().pack.filter((entry) => entry !== item);
    this.store.patch({ pack: checked ? [...pack, item] : pack });
  }

  protected suggest(value: string): void {
    if (!value.trim()) return;
    this.store.patch({ suggestions: [...this.store.state().suggestions, value.trim()] });
    this.notice.set('suggestThanks');
  }

  protected saveReview(id: string, score: number, text: string): void {
    if (!id || !text.trim()) return;
    this.store.patch({
      reviews: { ...this.store.state().reviews, [id]: { score, text: text.trim() } },
    });
    this.notice.set('saved');
  }

  protected async download(): Promise<void> {
    if (this.downloading() || this.downloaded()) return;
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
