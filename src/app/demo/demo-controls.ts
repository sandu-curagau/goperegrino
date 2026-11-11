import { Component, inject } from '@angular/core';
import { IonIcon } from '@ionic/angular';
import { DemoStore } from './demo-store';
import { Locale } from './locale';

@Component({
  selector: 'app-demo-controls',
  imports: [IonIcon],
  template: `
    <div class="controls">
      @if (
        store.started() && !store.walkClosed() && !store.planningAnother() && store.route();
        as route
      ) {
        <p class="simulation-help">{{ locale.t('demoSimulationHelp') }}</p>
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
                (click)="store.jumpTo(index)"
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

      <details class="gesture-help">
        <summary>{{ locale.t('mapGestures') }}</summary>
        <p>{{ locale.t('desktopMapGestures') }}</p>
        <p>{{ locale.t('mobileMapGestures') }}</p>
      </details>
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
  protected readonly speeds = [1, 10, 50];

  protected toggleWalk(): void {
    if (!this.store.started() || this.store.walkClosed()) return;
    this.store.playing.update((playing) => !playing);
  }

  protected reset(): void {
    if (window.confirm(this.locale.t('resetConfirm'))) this.store.reset();
  }
}
