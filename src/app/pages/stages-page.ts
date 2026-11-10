import { Component, computed, inject, signal } from '@angular/core';
import { IonContent, IonIcon } from '@ionic/angular';
import { DemoStore } from '../demo/demo-store';
import { itinerary } from '../demo/itinerary';
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
              <li class="surface row-card">
                <span class="number-chip">{{ stage.day }}</span>
                <div>
                  <p class="kicker">
                    {{ locale.t('day') }} {{ stage.day }} · {{ locale.date(stage.date) }}
                  </p>
                  <strong>{{ stage.from }} → {{ stage.to }}</strong>
                  <small
                    ><ion-icon name="bed-outline" aria-hidden="true"></ion-icon>
                    {{ stage.to }}</small
                  >
                </div>
                <span class="stage-distances"
                  ><strong>{{ stage.km }} km</strong><small>↑ {{ stage.ascent }} m</small></span
                >
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
                  <select #days [value]="store.state().days">
                    @for (stage of route.stages; track stage.id) {
                      <option [value]="stage.id" [selected]="stage.id === store.state().days">
                        {{ stage.id }}
                      </option>
                    }
                  </select>
                </label>
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
    .row-card .kicker {
      margin-bottom: 4px;
      font-size: 8px;
    }
    .row-card .number-chip {
      flex: none;
    }
    .stage-distances {
      text-align: right;
      white-space: nowrap;
    }
  `,
})
export class StagesPage {
  protected readonly store = inject(DemoStore);
  protected readonly locale = inject(Locale);
  protected readonly editing = signal(false);
  protected readonly plan = computed(() => {
    const route = this.store.route();
    if (!route) return [];
    const { days, date } = this.store.state();
    return itinerary(route, this.store.premium() ? days : route.stages.length, date);
  });

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
