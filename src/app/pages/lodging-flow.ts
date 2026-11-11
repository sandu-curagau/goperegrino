import {
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import { IonIcon } from '@ionic/angular';
import { DemoStore } from '../demo/demo-store';
import { Locale, Message } from '../demo/locale';
import { dateInput, Lodging, plusDays, Reservation, RoomType, stayPrice } from '../demo/models';
import { Sheet } from '../demo/sheet';
import { PaymentMethods } from './payment-methods';

const roomOptions: { type: RoomType; capacity: number; rate: number }[] = [
  { type: 'singleRoom', capacity: 1, rate: 1 },
  { type: 'doubleRoom', capacity: 2, rate: 1.25 },
  { type: 'twinRoom', capacity: 2, rate: 1.35 },
  { type: 'familyRoom', capacity: 4, rate: 1.65 },
];
const stepTitles = ['book', 'roomChoice', 'paymentDetails', 'bookingDone'] as const;

@Component({
  selector: 'app-lodging-flow',
  imports: [Sheet, IonIcon, PaymentMethods],
  templateUrl: './lodging-flow.html',
  styleUrl: './lodging-flow.scss',
})
export class LodgingFlow {
  readonly lodging = input.required<Lodging>();
  readonly plannedArrival = input<string>();
  readonly closed = output<void>();
  protected readonly locale = inject(Locale);
  protected readonly store = inject(DemoStore);
  private readonly router = inject(Router);
  private readonly sheet = viewChild(Sheet);
  protected readonly step = signal(0);
  protected readonly photo = signal(0);
  protected readonly contact = signal(false);
  protected readonly arrival = signal(dateInput());
  protected readonly departure = signal(plusDays(dateInput(), 1));
  protected readonly guests = signal(1);
  protected readonly roomType = signal<RoomType | null>(null);
  protected readonly guestName = signal('Peregrino de Teste');
  protected readonly guestEmail = signal('peregrino@example.com');
  protected readonly paymentCard = computed(() =>
    this.store
      .state()
      .paymentCards.find((card) => card.id === this.store.state().defaultPaymentCard),
  );
  protected readonly roomChoices = computed(() => {
    const base = this.lodging().price;
    const arrival = this.arrival();
    const departure = this.departure();
    const guests = this.guests();
    return roomOptions.map((option) => {
      const nightly = Math.round(base * option.rate);
      return {
        ...option,
        nightly,
        ...stayPrice(arrival, departure, guests, nightly, option.capacity),
      };
    });
  });
  protected readonly price = computed(() => {
    const selected =
      this.roomType() ??
      (this.guests() === 1 ? 'singleRoom' : this.guests() === 2 ? 'doubleRoom' : 'familyRoom');
    return this.roomChoices().find((room) => room.type === selected)!;
  });
  protected readonly booking = signal<Reservation | null>(null);
  protected readonly today = dateInput();
  protected readonly nextDay = computed(() => plusDays(this.arrival(), 1));
  protected readonly title = computed(() => {
    const step = this.step();
    if (step === 0) return this.lodging().name;
    return this.locale.t(stepTitles[step - 1]) + (step === 4 ? '' : ' · ' + step + '/3');
  });

  constructor() {
    effect(() => {
      const date = this.plannedArrival();
      if (date && date >= this.today) {
        this.arrival.set(date);
        this.departure.set(plusDays(date, 1));
      }
    });
  }

  protected submit(): void {
    if (this.store.offline()) return;
    if (this.step() < 3) this.goToStep(this.step() + 1);
    else this.confirm();
  }

  protected goToStep(step: number): void {
    this.step.set(step);
    this.sheet()?.scrollToTop();
  }

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

  private confirm(): void {
    const name = this.guestName().trim();
    if (!name || !this.paymentCard() || this.booking() || this.store.offline()) return;
    const { type, rooms, total } = this.price();
    const booking: Reservation = {
      walkId: this.store.state().walkId,
      code: 'GP-' + crypto.randomUUID().slice(0, 8).toUpperCase(),
      lodgingId: this.lodging().id,
      arrival: this.arrival(),
      departure: this.departure(),
      guests: this.guests(),
      name,
      status: 'confirmed',
      roomType: type,
      rooms,
      total,
    };
    this.store.patch({ reservations: [booking, ...this.store.state().reservations] });
    this.booking.set(booking);
    this.goToStep(4);
  }

  protected viewBookings(): void {
    this.closed.emit();
    void this.router.navigateByUrl('/reservas');
  }
}
