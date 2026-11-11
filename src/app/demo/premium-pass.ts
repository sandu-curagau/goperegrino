import { Component, inject, signal } from '@angular/core';
import { IonIcon } from '@ionic/angular';
import { DemoStore } from './demo-store';
import { Locale, Message } from './locale';
import { Sheet } from './sheet';

const plans = [
  { days: 7, price: 2.99, label: 'days7' },
  { days: 30, price: 4.99, label: 'days30' },
] as const;

@Component({
  selector: 'app-premium-pass',
  imports: [Sheet, IonIcon],
  template: `
    <app-sheet title="GoPeregrino Premium" (closed)="store.premiumOpen.set(false)">
      <div class="premium-intro">
        <span class="premium-icon"
          ><ion-icon name="sparkles-outline" aria-hidden="true"></ion-icon
        ></span>
        <p class="kicker">GoPeregrino Premium</p>
        @if (store.premium(); as active) {
          <h2>{{ locale.t('premiumActive') }}</h2>
          <p>
            {{ locale.t('activePass', { duration: locale.t(active === 7 ? 'days7' : 'days30') }) }}
          </p>
        } @else {
          <h2>{{ locale.t('premiumTitle') }}</h2>
          <p>{{ locale.t('premiumCopy') }}</p>
        }
      </div>

      @if (!store.premium()) {
        <fieldset class="passes">
          <legend class="sr-only">Premium</legend>
          @for (plan of plans; track plan.days) {
            <label class="pass surface" [class.selected]="selected() === plan.days">
              <input
                type="radio"
                name="premium-plan"
                [checked]="selected() === plan.days"
                (change)="selected.set(plan.days)"
              />
              <span class="kicker">{{ locale.t(plan.label) }}</span>
              <strong>{{ locale.money(plan.price) }}</strong>
            </label>
          }
        </fieldset>
      }

      <ul class="benefits">
        @for (feature of features; track feature) {
          <li>
            <ion-icon name="checkmark-outline" aria-hidden="true"></ion-icon>{{ locale.t(feature) }}
          </li>
        }
      </ul>
      @if (!store.premium()) {
        <button class="primary wide" type="button" [disabled]="store.offline()" (click)="buy()">
          @if (store.offline()) {
            <ion-icon name="cloud-offline-outline" aria-hidden="true"></ion-icon>
          }
          {{ locale.t('buy') }}
          @if (!store.offline()) {
            <span aria-hidden="true">→</span>
          }
        </button>
        <p class="muted purchase-note">
          {{ locale.t(store.offline() ? 'connectionRequired' : 'simulatedPayment') }}
        </p>
      }
    </app-sheet>
  `,
  styles: `
    .premium-intro {
      padding: 14px;
      border-radius: 17px;
      background: #003058;
      color: #eff7ff;
    }
    .premium-icon {
      float: right;
      color: #ffd36d;
      font-size: 25px;
    }
    .premium-intro .kicker {
      color: #ffd36d;
    }
    .premium-intro h2 {
      color: #fff;
      margin: 6px 0;
      font-size: 22px;
    }
    .premium-intro p:last-child {
      margin: 0;
      font-size: 12px;
    }
    .passes {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      padding: 0;
      margin: 12px 0;
      border: 0;
    }
    .pass {
      position: relative;
      display: grid;
      gap: 3px;
      padding: 12px;
      cursor: pointer;
      font-size: 12px;
    }
    .pass input {
      position: absolute;
      inset: 12px 11px auto auto;
      accent-color: var(--link);
    }
    .pass strong {
      font-size: 23px;
      letter-spacing: -0.055em;
    }
    .pass.selected {
      border-color: var(--gold-line);
      background: var(--gold-wash);
    }
    .benefits {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 7px;
      padding: 0;
      margin: 14px 0;
      list-style: none;
    }
    .benefits li {
      display: flex;
      align-items: start;
      gap: 5px;
      color: var(--muted);
      font-size: 11px;
    }
    .benefits ion-icon {
      flex: none;
      color: var(--success);
      font-size: 14px;
    }
    .purchase-note {
      margin: 8px 0 0;
      text-align: center;
      font-size: 11px;
    }
  `,
})
export class PremiumPass {
  protected readonly store = inject(DemoStore);
  protected readonly locale = inject(Locale);
  protected readonly selected = signal<7 | 30>(
    this.store.premium() || (this.store.state().days <= 7 ? 7 : 30),
  );
  protected readonly plans = plans;
  protected readonly features: Message[] = [
    'offlineMaps',
    'planner',
    'extraAlerts',
    'advancedFilters',
    'journalPremium',
    'breaks',
    'packing',
    'adFree',
  ];

  protected buy(): void {
    if (this.store.premium() || this.store.offline()) return;
    this.store.patch({ premium: this.selected() });
    this.store.premiumOpen.set(false);
  }
}
