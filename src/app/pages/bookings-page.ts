import { Component, computed, inject, signal } from '@angular/core';
import { IonContent, IonIcon } from '@ionic/angular';
import { DemoStore } from '../demo/demo-store';
import { Locale } from '../demo/locale';
import { Reservation } from '../demo/models';
import { Sheet } from '../demo/sheet';

@Component({
  imports: [IonContent, IonIcon, Sheet],
  template: `
    <ion-content>
      <main class="page">
        <header class="page-heading">
          <p class="kicker">GoPeregrino</p>
          <h1>{{ locale.t('myBookings') }}</h1>
        </header>
        <div class="page-stack">
          @for (entry of bookings(); track entry.booking.code) {
            <button
              class="surface row-card booking-card"
              type="button"
              (click)="open(entry.booking.code)"
            >
              <span class="tile"><ion-icon name="bed-outline" aria-hidden="true"></ion-icon></span>
              <span>
                <strong>{{ entry.place.name }}</strong>
                <small
                  >{{ locale.date(entry.booking.arrival) }} –
                  {{ locale.date(entry.booking.departure) }}</small
                >
              </span>
              <span class="tag" [class.gold]="entry.booking.status === 'confirmed'">
                {{
                  entry.booking.status === 'confirmed'
                    ? entry.booking.code
                    : locale.t('bookingCancelled')
                }}
              </span>
            </button>
          } @empty {
            <section class="surface empty-card">
              <span class="tile"><ion-icon name="bed-outline" aria-hidden="true"></ion-icon></span>
              <h2>{{ locale.t('noBookings') }}</h2>
              <p>{{ locale.t('noBookingsCopy') }}</p>
            </section>
          }
        </div>
      </main>
    </ion-content>
    @if (selected(); as entry) {
      <app-sheet [title]="entry.place.name" (closed)="selection.set(null)">
        <div class="sheet-stack">
          <span class="tag" [class.gold]="entry.booking.status === 'confirmed'">
            {{
              locale.t(entry.booking.status === 'confirmed' ? 'bookingDone' : 'bookingCancelled')
            }}
            · {{ entry.booking.code }}
          </span>
          <div class="detail-line">
            <strong>{{ locale.t('guestName') }}</strong
            ><span>{{ entry.booking.name }}</span>
          </div>
          <div class="detail-line">
            <strong>{{ locale.t('arrival') }}</strong
            ><span>{{ locale.date(entry.booking.arrival) }}</span>
          </div>
          <div class="detail-line">
            <strong>{{ locale.t('leave') }}</strong
            ><span>{{ locale.date(entry.booking.departure) }}</span>
          </div>
          <div class="detail-line">
            <strong>{{ locale.t('guests') }}</strong
            ><span>{{ entry.booking.guests }}</span>
          </div>
          <button
            type="button"
            class="primary"
            (click)="selection.set(null); store.showLodging(entry.place.id)"
          >
            {{ locale.t('directions') }}
          </button>
          <button type="button" class="secondary" (click)="contact.set(true)">
            {{ locale.t('contact') }}
          </button>
          @if (contact()) {
            <p class="muted" role="status">{{ locale.t('contactDemo') }}</p>
          }
          @if (entry.booking.status === 'confirmed') {
            <button type="button" class="text-button danger-text" (click)="cancel(entry.booking)">
              {{ locale.t('cancelBooking') }}
            </button>
          }
        </div>
      </app-sheet>
    }
  `,
})
export class BookingsPage {
  protected readonly store = inject(DemoStore);
  protected readonly locale = inject(Locale);
  protected readonly selection = signal<string | null>(null);
  protected readonly contact = signal(false);
  protected readonly bookings = computed(() =>
    this.store.state().reservations.flatMap((booking) => {
      const place = this.store.lodgings().find((item) => item.id === booking.lodgingId);
      return place ? [{ booking, place }] : [];
    }),
  );
  protected readonly selected = computed(() =>
    this.bookings().find((entry) => entry.booking.code === this.selection()),
  );

  protected open(code: string): void {
    this.contact.set(false);
    this.selection.set(code);
  }

  protected cancel(booking: Reservation): void {
    if (!window.confirm(this.locale.t('cancelQuestion'))) return;
    this.store.patch({
      reservations: this.store
        .state()
        .reservations.map((entry) =>
          entry.code === booking.code ? { ...entry, status: 'cancelled' } : entry,
        ),
    });
  }
}
