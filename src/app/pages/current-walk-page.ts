import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { IonContent, IonIcon } from '@ionic/angular';
import { DemoStore } from '../demo/demo-store';
import { Locale, Message } from '../demo/locale';
import { kmBetween } from '../demo/models';
import { Sheet } from '../demo/sheet';
import { loadOfflinePack } from './offline-map';

type Section = 'journal' | 'packing' | 'breaks' | 'download';
type Action = Section | 'credencial' | 'writeReviews';
const sections: { id: Action; icon: string; premium: boolean }[] = [
  { id: 'journal', icon: 'book-outline', premium: true },
  { id: 'credencial', icon: 'ribbon-outline', premium: false },
  { id: 'breaks', icon: 'cafe-outline', premium: true },
  { id: 'writeReviews', icon: 'star-outline', premium: false },
  { id: 'packing', icon: 'bag-outline', premium: true },
  { id: 'download', icon: 'download-outline', premium: true },
];

@Component({
  imports: [IonContent, IonIcon, Sheet],
  templateUrl: './current-walk-page.html',
  styleUrl: './current-walk-page.scss',
})
export class CurrentWalkPage {
  protected readonly store = inject(DemoStore);
  protected readonly locale = inject(Locale);
  private readonly router = inject(Router);
  protected readonly sections = sections;
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
  protected readonly pauseSpots = computed(() => {
    const position = this.store.progress().position;
    if (!position) return [];
    return this.store
      .nearbyPoints()
      .filter((point) => point.kind === 'water' || point.kind === 'cafe')
      .map((point) => ({ ...point, km: kmBetween(position, point.coordinates) }))
      .filter((point) => point.km <= 5)
      .sort((a, b) => a.km - b.km)
      .slice(0, 4);
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
    if (section === 'credencial') {
      this.credential();
      return;
    }
    if (section === 'writeReviews') {
      this.reviewBookings();
      return;
    }
    this.notice.set(null);
    this.section.set(section);
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
