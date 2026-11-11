import { Component, computed, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { IonContent, IonIcon } from '@ionic/angular';
import { DemoStore } from '../demo/demo-store';
import { Locale } from '../demo/locale';
import { distanceToLodging, Reservation, stayPrice } from '../demo/models';
import { Sheet } from '../demo/sheet';

@Component({
  imports: [IonContent, IonIcon, Sheet],
  template: `
    <ion-content>
      <main class="page">
        <header class="page-heading">
          <p class="kicker">GoPeregrino</p>
          <h1>{{ locale.t('myBookings') }}</h1>
          @if (bookings().length) {
            <p>{{ locale.t('byDistance') }}</p>
          }
        </header>
        <div class="page-stack">
          @for (entry of bookings(); track entry.booking.code) {
            <article class="surface booking-summary">
              <button
                class="row-card booking-card"
                type="button"
                (click)="open(entry.booking.code)"
              >
                <span class="tile"
                  ><ion-icon name="bed-outline" aria-hidden="true"></ion-icon
                ></span>
                <span>
                  <strong>{{ entry.place.name }}</strong>
                  <small
                    >{{ locale.date(entry.booking.arrival) }} –
                    {{ locale.date(entry.booking.departure) }}</small
                  >
                  @if (entry.distance !== null) {
                    <small class="booking-distance">{{
                      locale.t('distanceAway', { km: locale.number(entry.distance, 1) })
                    }}</small>
                  }
                </span>
                <span class="tag" [class.gold]="entry.booking.status === 'confirmed'">
                  {{
                    entry.booking.status === 'confirmed'
                      ? entry.booking.code
                      : locale.t('bookingCancelled')
                  }}
                </span>
              </button>
              @if (entry.booking.status === 'confirmed') {
                <button
                  class="text-button review-shortcut"
                  type="button"
                  [attr.aria-label]="
                    locale.t(reviewAction(entry.place.id)) + ' · ' + entry.place.name
                  "
                  (click)="open(entry.booking.code, true)"
                >
                  <ion-icon name="star-outline" aria-hidden="true"></ion-icon>
                  {{ locale.t(reviewAction(entry.place.id)) }}
                </button>
              }
            </article>
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
      <app-sheet
        [title]="editingReview() ? locale.t(reviewAction(entry.place.id)) : entry.place.name"
        (closed)="selection.set(null)"
      >
        @if (editingReview()) {
          @let existing = store.state().reviews[entry.place.id];
          <form class="sheet-stack" (submit)="$event.preventDefault(); saveReview(review.value)">
            <strong>{{ entry.place.name }}</strong>
            <fieldset class="star-field">
              <legend>{{ locale.t('rating') }}</legend>
              <div>
                @for (star of stars; track star) {
                  <label [class.lit]="star <= score()">
                    <input
                      class="sr-only"
                      type="radio"
                      name="rating"
                      [value]="star"
                      [attr.aria-label]="star + ' / 5'"
                      [checked]="score() === star"
                      (change)="score.set(star)"
                    />
                    <span aria-hidden="true">★</span>
                  </label>
                }
              </div>
            </fieldset>
            <label class="field"
              >{{ locale.t('review') }}
              <textarea
                #review
                rows="4"
                maxlength="280"
                [value]="existing?.text ?? ''"
                required
              ></textarea>
            </label>
            <p class="muted">{{ locale.t('reviewLocalCopy') }}</p>
            <button class="primary" type="submit">{{ locale.t('save') }}</button>
            <button class="text-button" type="button" (click)="editingReview.set(false)">
              {{ locale.t('back') }}
            </button>
          </form>
        } @else {
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
            @if (entry.booking.roomType; as roomType) {
              <div class="detail-line">
                <strong>{{ locale.t('rooms') }}</strong
                ><span>{{ entry.booking.rooms }} × {{ locale.t(roomType) }}</span>
              </div>
            }
            @if (entry.distance !== null) {
              <div class="detail-line">
                <strong>{{ locale.t('byDistance') }}</strong
                ><span>{{
                  locale.t('distanceAway', { km: locale.number(entry.distance, 1) })
                }}</span>
              </div>
            }
            <div class="detail-line">
              <strong>{{ locale.t('totalStay') }}</strong
              ><span>{{ locale.money(entry.total) }}</span>
            </div>
            <button
              type="button"
              class="primary"
              (click)="selection.set(null); store.showLodging(entry.place.id)"
            >
              {{ locale.t('directions') }}
            </button>
            <button
              type="button"
              class="secondary"
              [disabled]="store.offline()"
              (click)="contact.set(true)"
            >
              @if (store.offline()) {
                <ion-icon name="cloud-offline-outline" aria-hidden="true"></ion-icon>
              }
              {{ locale.t('contact') }}
            </button>
            @if (store.offline()) {
              <p class="muted">{{ locale.t('connectionRequired') }}</p>
            } @else if (contact()) {
              <p class="muted" role="status">{{ locale.t('contactDemo') }}</p>
            }
            @if (entry.booking.status === 'confirmed') {
              @if (store.state().reviews[entry.place.id]; as review) {
                <div class="surface booking-review">
                  <strong>★ {{ review.score }}/5</strong>
                  <p>{{ review.text }}</p>
                </div>
              }
              <button type="button" class="secondary" (click)="editReview(entry.place.id)">
                <ion-icon name="star-outline" aria-hidden="true"></ion-icon
                >{{ locale.t(reviewAction(entry.place.id)) }}
              </button>
              @if (reviewSaved()) {
                <p class="muted" role="status">{{ locale.t('saved') }}</p>
              }
              <button
                type="button"
                class="text-button danger-text"
                [disabled]="store.offline()"
                (click)="cancel(entry.booking)"
              >
                @if (store.offline()) {
                  <ion-icon name="cloud-offline-outline" aria-hidden="true"></ion-icon>
                }
                {{ locale.t('cancelBooking') }}
              </button>
            }
          </div>
        }
      </app-sheet>
    }
  `,
  styles: `
    .booking-distance {
      color: var(--brand);
      font-weight: 750;
    }
    .booking-card {
      width: 100%;
      background: transparent;
    }
    .review-shortcut {
      margin: 0 8px 4px;
      min-height: 37px;
    }
    .booking-review {
      padding: 11px;
    }
    .booking-review p {
      margin: 6px 0 0;
      overflow-wrap: anywhere;
      white-space: pre-wrap;
    }
    .star-field {
      margin: 0;
      padding: 0;
      border: 0;
    }
    .star-field legend {
      font-size: 12px;
      font-weight: 700;
    }
    .star-field div {
      display: flex;
      gap: 6px;
      margin-top: 6px;
    }
    .star-field label {
      display: grid;
      place-items: center;
      min-width: 40px;
      min-height: 43px;
      border: 1px solid var(--line);
      border-radius: 9px;
      background: #fff;
      color: #738392;
      font-size: 20px;
      cursor: pointer;
    }
    .star-field label.lit {
      background: #fff1c9;
      color: #765000;
    }
    .star-field label:focus-within {
      outline: 2px solid var(--brand);
    }
  `,
})
export class BookingsPage {
  protected readonly store = inject(DemoStore);
  protected readonly locale = inject(Locale);
  protected readonly selection = signal<string | null>(null);
  protected readonly contact = signal(false);
  private readonly routeFilter = signal('');
  protected readonly editingReview = signal(false);
  protected readonly reviewSaved = signal(false);
  protected readonly score = signal(5);
  protected readonly stars = [1, 2, 3, 4, 5];
  private readonly sheet = viewChild(Sheet);
  protected readonly bookings = computed(() => {
    const position = this.store.progress().position;
    return this.store
      .state()
      .reservations.flatMap((booking) => {
        const place = this.store.lodgings().find((item) => item.id === booking.lodgingId);
        return place && (!this.routeFilter() || place.routeId === this.routeFilter())
          ? [
              {
                booking,
                place,
                distance: distanceToLodging(position, place),
                total:
                  booking.total ??
                  stayPrice(booking.arrival, booking.departure, booking.guests, place.price).total,
              },
            ]
          : [];
      })
      .sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity));
  });
  protected readonly selected = computed(() =>
    this.bookings().find((entry) => entry.booking.code === this.selection()),
  );

  constructor() {
    inject(ActivatedRoute)
      .queryParamMap.pipe(takeUntilDestroyed())
      .subscribe((params) => {
        this.routeFilter.set(params.get('route') ?? '');
      });
  }

  protected open(code: string, review = false): void {
    this.contact.set(false);
    this.reviewSaved.set(false);
    this.editingReview.set(false);
    this.selection.set(code);
    const booking = this.selected();
    if (review && booking?.booking.status === 'confirmed') this.editReview(booking.place.id);
  }

  protected reviewAction(id: string): 'reviewStay' | 'editReview' {
    return this.store.state().reviews[id] ? 'editReview' : 'reviewStay';
  }

  protected editReview(id: string): void {
    this.score.set(this.store.state().reviews[id]?.score ?? 5);
    this.reviewSaved.set(false);
    this.editingReview.set(true);
    this.sheet()?.scrollToTop();
  }

  protected saveReview(value: string): void {
    const entry = this.selected();
    const text = value.trim();
    const score = this.score();
    if (entry?.booking.status !== 'confirmed' || !text || !this.stars.includes(score)) return;
    this.store.patch({
      reviews: { ...this.store.state().reviews, [entry.place.id]: { score, text } },
    });
    this.editingReview.set(false);
    this.reviewSaved.set(true);
  }

  protected cancel(booking: Reservation): void {
    if (this.store.offline() || !window.confirm(this.locale.t('cancelQuestion'))) return;
    this.store.patch({
      reservations: this.store
        .state()
        .reservations.map((entry) =>
          entry.code === booking.code ? { ...entry, status: 'cancelled' } : entry,
        ),
    });
  }
}
