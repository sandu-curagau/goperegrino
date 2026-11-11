import { Component, computed, inject, input, signal } from '@angular/core';
import { IonIcon } from '@ionic/angular';
import { DemoStore } from '../demo/demo-store';
import { Locale } from '../demo/locale';

const demoCards = [
  { brand: 'Visa', last4: '4242', expiry: '12/30' },
  { brand: 'Mastercard', last4: '4444', expiry: '10/31' },
  { brand: 'American Express', last4: '0005', expiry: '09/31' },
];

@Component({
  selector: 'app-payment-methods',
  imports: [IonIcon],
  template: `
    <div class="sheet-stack">
      <p class="muted">{{ locale.t('demoCards') }}</p>
      @for (card of store.state().paymentCards; track card.id) {
        <div
          class="surface wallet-card"
          [class.selected]="store.state().defaultPaymentCard === card.id"
        >
          <label>
            <input
              type="radio"
              [name]="management() ? 'profile-card' : 'checkout-card'"
              [checked]="store.state().defaultPaymentCard === card.id"
              (change)="select(card.id)"
              [disabled]="store.offline()"
            />
            <span
              ><strong>{{ card.nickname || card.brand }} ···· {{ card.last4 }}</strong>
              <small>{{ card.brand }} · {{ locale.t('cardExpiry') }} {{ card.expiry }}</small>
            </span>
          </label>
          @if (management()) {
            <button
              class="text-button"
              type="button"
              [disabled]="store.offline()"
              (click)="remove(card.id)"
              [attr.aria-label]="locale.t('removeCard') + ' ' + card.last4"
            >
              <ion-icon
                [name]="store.offline() ? 'cloud-offline-outline' : 'close-outline'"
                aria-hidden="true"
              ></ion-icon>
            </button>
          }
        </div>
      } @empty {
        <p class="muted">{{ locale.t('noCards') }}</p>
      }
      @if (adding()) {
        <div class="surface sheet-stack add-card">
          <label class="field"
            >{{ locale.t('testCard') }}
            <select #choice (change)="preset.set(+choice.value)" [value]="preset()">
              @for (card of available(); track card.last4; let index = $index) {
                <option [value]="index">{{ card.brand }} ···· {{ card.last4 }}</option>
              }
            </select>
          </label>
          <label class="field"
            >{{ locale.t('cardNickname') }}
            <input
              #name
              type="text"
              maxlength="30"
              [value]="nickname()"
              (input)="nickname.set(name.value)"
            />
          </label>
          <div class="wallet-actions">
            <button class="secondary" type="button" (click)="adding.set(false)">
              {{ locale.t('cancel') }}
            </button>
            <button
              class="primary"
              type="button"
              (click)="add()"
              [disabled]="store.offline() || !available().length"
            >
              {{ locale.t('save') }}
            </button>
          </div>
        </div>
      } @else if (available().length) {
        <button
          class="secondary wide"
          type="button"
          [disabled]="store.offline()"
          (click)="adding.set(true); preset.set(0); nickname.set('')"
        >
          <ion-icon
            [name]="store.offline() ? 'cloud-offline-outline' : 'card-outline'"
            aria-hidden="true"
          ></ion-icon>
          {{ locale.t('addCard') }}
        </button>
      }
    </div>
  `,
  styles: `
    p {
      margin: 0;
      font-size: 12px;
    }
    .wallet-card {
      display: flex;
      align-items: center;
      padding: 10px;
      gap: 5px;
    }
    .wallet-card.selected {
      background: #fff6e1;
      border-color: #c38c28;
    }
    .wallet-card label {
      display: flex;
      align-items: center;
      flex: 1;
      gap: 9px;
      cursor: pointer;
      min-height: 40px;
    }
    .wallet-card strong {
      font-size: 13px;
    }
    .wallet-card small {
      display: block;
      margin-top: 4px;
      color: var(--muted);
      font-size: 11px;
    }
    .wallet-card input {
      accent-color: var(--brand);
    }
    .wallet-card button {
      padding: 5px;
      min-width: 38px;
    }
    .add-card {
      padding: 12px;
    }
    .wallet-actions {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 7px;
    }
  `,
})
export class PaymentMethods {
  protected readonly store = inject(DemoStore);
  protected readonly locale = inject(Locale);
  readonly management = input(true);
  protected readonly adding = signal(false);
  protected readonly preset = signal(0);
  protected readonly nickname = signal('');
  protected readonly available = computed(() =>
    demoCards.filter(
      (card) => !this.store.state().paymentCards.some((saved) => saved.last4 === card.last4),
    ),
  );

  protected select(id: string): void {
    if (this.store.offline()) return;
    this.store.patch({ defaultPaymentCard: id });
  }

  protected add(): void {
    const card = this.available()[this.preset()];
    if (!card || this.store.offline()) return;
    const saved = { ...card, id: crypto.randomUUID(), nickname: this.nickname().trim() };
    this.store.patch({
      paymentCards: [...this.store.state().paymentCards, saved],
      defaultPaymentCard: saved.id,
    });
    this.adding.set(false);
  }

  protected remove(id: string): void {
    if (this.store.offline()) return;
    const cards = this.store.state().paymentCards.filter((card) => card.id !== id);
    this.store.patch({
      paymentCards: cards,
      defaultPaymentCard:
        this.store.state().defaultPaymentCard === id
          ? (cards[0]?.id ?? '')
          : this.store.state().defaultPaymentCard,
    });
  }
}
