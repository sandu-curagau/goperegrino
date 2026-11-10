import { Component, computed, inject, input, output, signal } from '@angular/core';
import { Router } from '@angular/router';
import { IonIcon } from '@ionic/angular';
import { DemoStore } from '../demo/demo-store';
import { Locale, Message } from '../demo/locale';
import { dateInput, Lodging, plusDays, Reservation, stayPrice } from '../demo/models';
import { Sheet } from '../demo/sheet';

@Component({
  selector: 'app-lodging-flow',
  imports: [Sheet, IonIcon],
  templateUrl: './lodging-flow.html',
  styleUrl: './lodging-flow.scss',
})
export class LodgingFlow {
  readonly lodging = input.required<Lodging>();
  readonly closed = output<void>();
  protected readonly locale = inject(Locale);
  protected readonly store = inject(DemoStore);
  private readonly router = inject(Router);
  protected readonly step = signal(0);
  protected readonly photo = signal(0);
  protected readonly contact = signal(false);
  protected readonly arrival = signal(dateInput());
  protected readonly departure = signal(plusDays(dateInput(), 1));
  protected readonly guests = signal(1);
  protected readonly price = computed(() =>
    stayPrice(this.arrival(), this.departure(), this.guests(), this.lodging().price),
  );
  protected readonly booking = signal<Reservation | null>(null);
  protected readonly today = dateInput();
  protected readonly nextDay = computed(() => plusDays(this.arrival(), 1));
  protected readonly title = computed(() => {
    if (this.step() === 0) return this.lodging().name;
    return (
      this.locale.t(this.step() === 3 ? 'bookingDone' : 'book') +
      (this.step() === 3 ? '' : ' · ' + this.step() + '/2')
    );
  });

  protected feature(key: string): string {
    return this.locale.t(key as Message);
  }

  protected advancePhoto(offset: number): void {
    const count = this.lodging().photos.length;
    this.photo.update((index) => (index + offset + count) % count);
  }

  protected changeArrival(date: string): void {
    if (!date) return;
    this.arrival.set(date);
    if (this.departure() <= date) this.departure.set(plusDays(date, 1));
  }

  protected confirm(name: string): void {
    if (!name.trim() || this.booking() || this.store.offline()) return;
    const booking: Reservation = {
      code: 'GP-' + crypto.randomUUID().slice(0, 8).toUpperCase(),
      lodgingId: this.lodging().id,
      arrival: this.arrival(),
      departure: this.departure(),
      guests: this.guests(),
      name: name.trim(),
      status: 'confirmed',
      total: this.price().total,
    };
    this.store.patch({ reservations: [booking, ...this.store.state().reservations] });
    this.booking.set(booking);
    this.step.set(3);
  }

  protected viewBookings(): void {
    this.closed.emit();
    void this.router.navigateByUrl('/reservas');
  }
}
