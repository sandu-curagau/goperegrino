import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { IonIcon } from '@ionic/angular';
import { DemoStore } from './demo-store';
import { Locale } from './locale';

@Component({
  selector: 'app-demo-controls',
  imports: [IonIcon],
  template: `
    <div class="controls">
      <label class="field"
        >{{ locale.t('choose') }}
        <select
          #routeSelect
          [value]="store.state().routeId"
          (change)="changeRoute(routeSelect.value)"
        >
          @for (route of store.routes(); track route.id) {
            <option [value]="route.id" [selected]="store.state().routeId === route.id">
              {{ route.name }}
            </option>
          }
        </select>
      </label>

      @if (store.route(); as route) {
        <label class="distance">
          <span
            >{{ locale.t('position') }}
            <strong>{{ locale.number(store.state().distance, 1) }} km</strong></span
          >
          <input
            #range
            type="range"
            min="0"
            [max]="route.km"
            step="0.1"
            [value]="store.state().distance"
            (input)="store.seek(+range.value)"
          />
        </label>

        <div class="stages" [attr.aria-label]="locale.t('jump')" role="group">
          <span class="control-label">{{ locale.t('jump') }}</span>
          <div class="stage-buttons">
            @for (stage of store.walkingPlan(); track stage.day; let index = $index) {
              <button
                type="button"
                [class.active]="store.walkingDayIndex() === index"
                [attr.aria-pressed]="store.walkingDayIndex() === index"
                [attr.aria-label]="locale.t('jump') + ' ' + stage.day + ' · ' + stage.from"
                (click)="jump(index)"
              >
                {{ stage.day }}
              </button>
            }
          </div>
        </div>
        <div class="transport">
          <button type="button" class="play" (click)="toggleWalk()">
            <ion-icon
              [name]="store.playing() ? 'pause-outline' : 'play-outline'"
              aria-hidden="true"
            ></ion-icon>
            {{ locale.t(store.playing() ? 'pause' : 'walk') }}
          </button>
          <div class="speed-buttons">
            @for (speed of speeds; track speed) {
              <button
                type="button"
                [class.active]="store.speed() === speed"
                [attr.aria-pressed]="store.speed() === speed"
                (click)="store.speed.set(speed)"
              >
                ×{{ speed }}
              </button>
            }
          </div>
        </div>
      }

      <label class="switch">
        <span>{{ locale.t('network') }}</span>
        <input
          #offline
          type="checkbox"
          [checked]="store.state().offline"
          (change)="store.patch({ offline: offline.checked })"
        />
      </label>
      <label class="switch">
        <span>{{ locale.t('premiumActive') }}</span>
        <input
          #premium
          type="checkbox"
          [checked]="!!store.state().premium"
          (change)="store.patch({ premium: premium.checked ? 30 : 0 })"
        />
      </label>
      <button class="reset" type="button" (click)="reset()">
        <ion-icon name="refresh-outline" aria-hidden="true"></ion-icon>{{ locale.t('reset') }}
      </button>
    </div>
  `,
  styleUrl: './demo-controls.scss',
})
export class DemoControls {
  protected readonly store = inject(DemoStore);
  protected readonly locale = inject(Locale);
  private readonly router = inject(Router);
  protected readonly speeds = [1, 10, 50];

  protected changeRoute(id: string): void {
    this.store.chooseRoute(id);
    void this.router.navigateByUrl('/mapa');
  }

  protected jump(index: number): void {
    if (!this.store.started()) this.changeRoute(this.store.state().routeId);
    this.store.jumpTo(index);
  }

  protected toggleWalk(): void {
    if (!this.store.started()) this.changeRoute(this.store.state().routeId);
    if (!this.store.remaining()) this.store.move(0, false);
    this.store.playing.update((playing) => !playing);
  }

  protected reset(): void {
    if (window.confirm(this.locale.t('resetConfirm'))) this.store.reset();
  }
}
