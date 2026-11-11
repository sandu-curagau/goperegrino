import { Component, computed, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { IonContent, IonIcon } from '@ionic/angular';
import { DemoStore } from '../demo/demo-store';
import { itinerary } from '../demo/itinerary';
import { Locale, Message } from '../demo/locale';
import { JournalEntry, plusDays } from '../demo/models';
import { Sheet } from '../demo/sheet';
import { sampleId, sampleDate, sampleEntries, sampleWalk } from '../demo/sample-walk';

const maxPhotos = 6;

async function journalPhoto(file: File): Promise<string> {
  const image = await createImageBitmap(file);
  try {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas unavailable');
    for (const limit of [900, 600, 400]) {
      const scale = Math.min(1, limit / Math.max(image.width, image.height));
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      context.fillStyle = '#fff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const result = canvas.toDataURL('image/jpeg', 0.72);
      if (result.length <= 170000) return result;
    }
    throw new Error('Photo too large');
  } finally {
    image.close();
  }
}

@Component({
  selector: 'app-trail-journal',
  imports: [IonContent, IonIcon, Sheet],
  templateUrl: './trail-journal.html',
  styleUrl: './trail-journal.scss',
})
export class TrailJournal {
  private readonly store = inject(DemoStore);
  private readonly router = inject(Router);
  private readonly content = viewChild(IonContent);
  protected readonly locale = inject(Locale);
  protected readonly premium = this.store.premium;
  private readonly currentOnly = signal(false);
  protected readonly selectedWalk = signal('');
  protected readonly editor = signal<JournalEntry | null>(null);
  protected readonly expandedPhoto = signal('');
  protected readonly draft = signal('');
  protected readonly photos = signal<string[]>([]);
  protected readonly feedback = signal<Message | null>(null);
  protected readonly loadingPhoto = signal(false);
  protected readonly maxPhotos = maxPhotos;
  protected readonly walks = computed(() => {
    const active = this.store.activeWalk();
    const routes = this.store.routes();
    const example = sampleWalk(routes);
    const walks = [...this.store.state().walkHistory];
    if (active) walks.unshift(active);
    if (example) walks.push(example);
    return walks.flatMap((walk) => {
      const route = routes.find((entry) => entry.id === walk.routeId);
      if (!route) return [];
      const sample = walk.id === sampleId;
      const entries: JournalEntry[] = sample
        ? sampleEntries.map(([day, location, photo, note]) => ({
            id: photo || 'note-' + day,
            walkId: sampleId,
            date: plusDays(sampleDate, day),
            location,
            photos: photo ? ['journal/' + photo + '.jpg'] : [],
            note: this.locale.t(note),
          }))
        : this.store
            .journal()
            .filter((entry) => entry.walkId === walk.id)
            .sort(
              (a, b) =>
                a.date.localeCompare(b.date) ||
                (a.createdAt ?? '').localeCompare(b.createdAt ?? ''),
            );
      const timeline = new Map(
        (walk.days ? itinerary(route, walk.days, walk.date) : []).map((day) => [day.date, day]),
      );
      const status: Message =
        walk.distance >= route.km
          ? 'trailFinished'
          : walk.id === active?.id
            ? 'walkActive'
            : 'walkArchived';
      return [
        {
          ...walk,
          route,
          entries,
          status,
          sample,
          active: walk.id === active?.id,
          cover: entries.find((entry) => entry.photos.length)?.photos[0],
          timeline,
          notesCount: entries.filter((entry) => !!entry.note).length,
          photoCount: entries.reduce((total, entry) => total + entry.photos.length, 0),
        },
      ];
    });
  });
  protected readonly walk = computed(() =>
    this.walks().find((item) => item.id === this.selectedWalk()),
  );

  constructor() {
    inject(ActivatedRoute)
      .queryParamMap.pipe(takeUntilDestroyed())
      .subscribe((params) => {
        const current = params.get('walk') === 'current';
        this.currentOnly.set(current);
        this.selectedWalk.set(current ? (this.store.activeWalk()?.id ?? '') : '');
      });
  }

  protected open(id: string): void {
    this.selectedWalk.set(id);
    this.feedback.set(null);
    void this.content()?.scrollToTop();
  }

  protected back(): void {
    if (this.editor()) this.editor.set(null);
    else if (this.currentOnly()) void this.router.navigateByUrl('/caminho');
    else if (this.walk()) this.open('');
    else void this.router.navigateByUrl('/perfil');
  }

  protected showPremium(): void {
    this.store.premiumOpen.set(true);
  }

  protected addEntry(): void {
    const walk = this.walk();
    const stage = this.store.stage();
    if (!walk?.active || !stage) return;
    const days = [...walk.timeline.values()];
    let end = 0;
    const day =
      days.find((day) => {
        end += day.km;
        return end > walk.distance;
      }) ?? days.at(-1);
    this.edit({
      id: crypto.randomUUID(),
      walkId: walk.id,
      date: day?.date ?? walk.date,
      createdAt: new Date().toISOString(),
      position: this.store.progress().position,
      location: this.store.completed() ? stage.to : stage.from + ' → ' + stage.to,
      note: '',
      photos: [],
    });
  }

  protected edit(entry: JournalEntry): void {
    this.editor.set(entry);
    this.draft.set(entry.note);
    this.photos.set(entry.photos);
    this.feedback.set(null);
    void this.content()?.scrollToTop();
  }

  protected place(entry: JournalEntry): string {
    const day = this.walk()?.timeline.get(entry.date);
    return (
      entry.location || (day ? day.from + ' → ' + day.to : this.locale.t('journalLocationUnknown'))
    );
  }

  protected fullDate(date: string): string {
    return new Intl.DateTimeFormat(this.locale.tag(), { dateStyle: 'medium' }).format(
      new Date(date + 'T12:00:00'),
    );
  }

  protected async addPhoto(input: HTMLInputElement): Promise<void> {
    const file = input.files?.[0];
    input.value = '';
    if (!file || this.loadingPhoto() || this.photos().length >= maxPhotos) return;
    this.loadingPhoto.set(true);
    this.feedback.set(null);
    try {
      const photo = await journalPhoto(file);
      this.photos.update((items) => [...items, photo]);
    } catch {
      this.feedback.set('journalPhotoError');
    } finally {
      this.loadingPhoto.set(false);
    }
  }

  protected removePhoto(index: number): void {
    this.photos.update((items) => items.filter((_, i) => i !== index));
    this.feedback.set(null);
  }

  protected save(): void {
    const entry = this.editor();
    if (!entry || this.loadingPhoto()) return;
    const saved = this.store.saveJournalEntry({
      ...entry,
      note: this.draft().trim(),
      photos: this.photos(),
    });
    this.feedback.set(saved ? 'saved' : 'journalSaveError');
    if (saved) this.editor.set(null);
  }
}
