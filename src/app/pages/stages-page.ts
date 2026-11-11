import { Component, inject, signal } from '@angular/core';
import { IonContent, IonIcon } from '@ionic/angular';
import { DemoStore } from '../demo/demo-store';
import { dayOptions } from '../demo/itinerary';
import { Locale } from '../demo/locale';
import { dateInput } from '../demo/models';
import { Sheet } from '../demo/sheet';

@Component({
  imports: [IonContent, IonIcon, Sheet],
  template: `
    <ion-content>
      <main class="page">
        @if (store.route(); as route) {
          <header class="page-heading">
            <p class="kicker">{{ route.destination }}</p>
            <h1>{{ locale.t('etapas') }}</h1>
            <p>{{ locale.t('planCopy', { name: route.destination }) }}</p>
          </header>

          <button class="secondary wide" type="button" (click)="edit()">
            <ion-icon
              [name]="store.premium() ? 'options-outline' : 'lock-closed-outline'"
              aria-hidden="true"
            ></ion-icon>
            {{ locale.t('personalize') }}
          </button>
          <ol class="itinerary">
            @for (stage of plan(); track stage.day) {
              <li class="surface stage-card">
                <span class="number-chip">{{ stage.day }}</span>
                <div class="stage-route">
                  <p class="kicker">
                    {{ locale.t('day', { day: stage.day }) }} · {{ locale.date(stage.date) }}
                  </p>
                  <strong>{{ stage.from }} → {{ stage.to }}</strong>
                </div>
                <span class="stage-distances"
                  ><strong>{{ locale.number(stage.km, 1) }} km</strong
                  ><small>{{ locale.t('ascentMetres', { metres: stage.ascent }) }}</small></span
                >
                <button
                  class="stage-stays"
                  type="button"
                  [disabled]="store.offline()"
                  (click)="store.showStayStop(stage.stopId)"
                >
                  <ion-icon
                    [name]="store.offline() ? 'cloud-offline-outline' : 'bed-outline'"
                    aria-hidden="true"
                  ></ion-icon>
                  <span>{{ locale.t('staysAt', { name: stage.to }) }}</span>
                  <ion-icon name="chevron-forward-outline" aria-hidden="true"></ion-icon>
                </button>
              </li>
            }
          </ol>

          @if (editing()) {
            <app-sheet [title]="locale.t('personalize')" (closed)="editing.set(false)">
              <form
                class="sheet-stack"
                (submit)="$event.preventDefault(); save(date.value, +days.value)"
              >
                <label class="field"
                  >{{ locale.t('departure') }}
                  <input #date type="date" [value]="store.state().date" required />
                </label>
                <label class="field"
                  >{{ locale.t('walkingDays') }}
                  <select #days [value]="plan().length">
                    @for (day of dayOptions(route); track day) {
                      <option [value]="day" [selected]="day === plan().length">
                        {{ day }}
                      </option>
                    }
                  </select>
                </label>
                <p class="muted">{{ locale.t('dayLimit') }}</p>
                <button class="primary" type="submit">{{ locale.t('save') }}</button>
              </form>
            </app-sheet>
          }
        }
      </main>
    </ion-content>
  `,
  styles: `
    .itinerary {
      display: grid;
      gap: 8px;
      padding: 0;
      list-style: none;
    }
    .stage-card {
      display: grid;
      grid-template-columns: 30px minmax(0, 1fr) auto;
      align-items: start;
      column-gap: 10px;
      padding: 14px 14px 0;
      overflow: hidden;
    }
    .stage-route strong {
      display: block;
      font-size: 13px;
      line-height: 1.5;
    }
    .stage-card .kicker {
      margin-top: 0;
      margin-bottom: 4px;
      font-size: 8px;
    }
    .stage-distances {
      text-align: right;
      white-space: nowrap;
      font-size: 13px;
    }
    .stage-distances small {
      display: block;
      margin-top: 5px;
      color: var(--muted);
      font-size: 10px;
    }
    .stage-stays {
      display: flex;
      grid-column: 1 / -1;
      align-items: center;
      gap: 9px;
      margin: 12px -14px 0;
      padding: 11px 14px;
      min-height: 44px;
      border-top: 1px solid var(--line);
      border-radius: 0;
      background: #edf3f5;
      color: var(--brand);
      font-size: 12px;
      font-weight: 600;
      text-align: left;
    }
    .stage-stays span {
      flex: 1;
    }
    .stage-stays ion-icon {
      flex: none;
      font-size: 18px;
    }
    .stage-stays ion-icon:last-child {
      font-size: 14px;
    }
  `,
})
export class StagesPage {
  protected readonly store = inject(DemoStore);
  protected readonly locale = inject(Locale);
  protected readonly editing = signal(false);
  protected readonly dayOptions = dayOptions;
  protected readonly plan = this.store.walkingPlan;

  protected edit(): void {
    if (this.store.premium()) this.editing.set(true);
    else this.store.premiumOpen.set(true);
  }

  protected save(date: string, days: number): void {
    if (!this.store.premium()) return;
    this.store.patch({ date: date || dateInput(), days });
    this.editing.set(false);
  }
}
