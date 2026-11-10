import { Component, computed, inject, signal } from '@angular/core';
import { IonContent, IonIcon } from '@ionic/angular';
import { DemoStore } from '../demo/demo-store';
import { Locale } from '../demo/locale';
import { dateInput, kmBetween, Stamp } from '../demo/models';
import { Sheet } from '../demo/sheet';

@Component({
  imports: [IonContent, IonIcon, Sheet],
  template: `
    <ion-content>
      <main class="page">
        <header class="page-heading">
          <p class="kicker">{{ store.route()?.name }}</p>
          <h1>{{ locale.t('credencial') }}</h1>
          <p>{{ locale.t('stampCopy') }}</p>
        </header>
        <section class="passport">
          <div>
            <p class="kicker">{{ store.route()?.destination }}</p>
            <strong>{{ stampCount() }}</strong>
            @if (showTarget()) {
              <span class="stamp-target">/ 2</span>
            }
            <span class="today">{{ locale.t('today') }}</span>
          </div>
          <ion-icon name="ribbon-outline" aria-hidden="true"></ion-icon>
          @if (showTarget()) {
            <p>{{ locale.t('compostela') }}</p>
          }
        </section>

        <div class="passport-actions">
          <button class="primary" type="button" (click)="stamp()">
            <ion-icon name="ribbon-outline" aria-hidden="true"></ion-icon>{{ locale.t('stamp') }}
          </button>
          <button
            class="secondary"
            type="button"
            [attr.aria-label]="locale.t('stampSpots')"
            (click)="showMap.set(true)"
          >
            <ion-icon name="map-outline" aria-hidden="true"></ion-icon>
          </button>
        </div>
        @if (stamped()) {
          <p class="kicker stamp-status" role="status">{{ locale.t('stampAdded') }}</p>
        }
        @for (group of groups(); track group.date) {
          <h2>{{ locale.date(group.date) }}</h2>
          <div class="page-stack">
            @for (stamp of group.items; track stamp.id) {
              <div class="surface row-card">
                <span class="tile"
                  ><ion-icon name="ribbon-outline" aria-hidden="true"></ion-icon
                ></span>
                <span
                  ><strong>{{ stamp.name }}</strong
                  ><small>{{ time(stamp.date) }}</small></span
                >
              </div>
            }
          </div>
        } @empty {
          <p class="surface empty-card muted">{{ locale.t('stampEmpty') }}</p>
        }
      </main>
    </ion-content>

    @if (showMap()) {
      <app-sheet [title]="locale.t('stampSpots')" (closed)="showMap.set(false)">
        <div class="sheet-stack">
          <svg class="stamp-map" viewBox="0 0 300 155" aria-hidden="true">
            <rect width="300" height="155" rx="15" fill="#e4efe8" />
            <path
              d="M-9 85C42 29 79 110 123 73S217 44 307 79M-9 133C68 116 104 138 149 99s91 8 160-32"
              fill="none"
              stroke="#c3d8d2"
              stroke-width="15"
            />
            <polyline
              [attr.points]="mapPath()"
              fill="none"
              stroke="#003058"
              stroke-width="4"
              stroke-linecap="round"
              stroke-dasharray="6 6"
            />
            @for (pin of pins(); track pin.id; let index = $index) {
              <circle
                [attr.cx]="pin.x"
                [attr.cy]="pin.y"
                r="13"
                fill="#f2a602"
                stroke="white"
                stroke-width="2"
              />
              <text
                [attr.x]="pin.x"
                [attr.y]="pin.y + 4"
                text-anchor="middle"
                font-size="11"
                font-weight="800"
                fill="#003058"
              >
                {{ index + 1 }}
              </text>
            }
          </svg>
          @for (pin of pins(); track pin.id; let index = $index) {
            <div class="surface row-card">
              <span class="number-chip">{{ index + 1 }}</span>
              <span
                ><strong>{{ pin.location }}</strong
                ><small>{{ locale.number(pin.distance, 1) }} km</small></span
              >
            </div>
          }
        </div>
      </app-sheet>
    }
  `,
  styles: `
    .passport {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 7px;
      padding: 18px;
      border-radius: 22px;
      background: radial-gradient(ellipse at 100% 0%, #24617a, #003058 73%);
      color: white;
    }
    .passport .kicker {
      color: #ffdb78;
    }
    .passport strong {
      font-size: 37px;
      letter-spacing: -0.06em;
    }
    .stamp-target {
      color: #e1eaf3;
      font-size: 19px;
      margin-left: 4px;
    }
    .today {
      display: block;
      font-size: 12px;
      color: #e1eaf3;
    }
    .passport ion-icon {
      place-self: center;
      color: #ffdc74;
      font-size: 45px;
    }
    .passport p {
      grid-column: 1 / -1;
      margin: 3px 0 0;
      font-size: 12px;
    }
    .passport-actions {
      display: grid;
      grid-template-columns: 1fr 54px;
      gap: 8px;
      margin: 10px 0;
    }
    .stamp-status {
      margin: 10px 0;
    }
    .stamp-map {
      width: 100%;
    }
  `,
})
export class PassportPage {
  protected readonly store = inject(DemoStore);
  protected readonly locale = inject(Locale);
  protected readonly stamped = signal(false);
  protected readonly showMap = signal(false);
  private readonly stamps = computed(() =>
    this.store.state().stamps.filter((stamp) => stamp.routeId === this.store.state().routeId),
  );
  protected readonly showTarget = computed(
    () => this.store.route()?.destination === 'Santiago' && this.store.remaining() <= 100,
  );
  protected readonly stampCount = computed(() => {
    const today = dateInput();
    return this.stamps().filter((stamp) => dateInput(new Date(stamp.date)) === today).length;
  });
  protected readonly groups = computed(() => {
    const groups = new Map<string, Stamp[]>();
    for (const stamp of this.stamps()) {
      const date = dateInput(new Date(stamp.date));
      const day = groups.get(date) ?? [];
      day.push(stamp);
      groups.set(date, day);
    }
    return Array.from(groups, ([date, items]) => ({ date, items }));
  });
  protected readonly pins = computed(() => {
    const points = this.store.nearbyPoints().filter((point) => point.kind === 'stamp');
    const position = this.store.progress().position;
    if (!points.length || !position) return [];
    const xs = points.map((point) => point.coordinates[0]);
    const ys = points.map((point) => point.coordinates[1]);
    const west = Math.min(...xs);
    const south = Math.min(...ys);
    const width = Math.max(...xs) - west;
    const height = Math.max(...ys) - south;
    return points.map((point) => ({
      ...point,
      x: width ? 35 + ((point.coordinates[0] - west) / width) * 230 : 150,
      y: height ? 120 - ((point.coordinates[1] - south) / height) * 85 : 76,
      distance: kmBetween(position, point.coordinates),
    }));
  });
  protected readonly mapPath = computed(() =>
    this.pins()
      .map((pin) => pin.x + ',' + pin.y)
      .join(' '),
  );

  protected time(value: string): string {
    return new Intl.DateTimeFormat(this.locale.tag(), {
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(value));
  }

  protected stamp(): void {
    const stage = this.store.stage();
    if (!stage) return;
    const name = this.store.stageRemaining() > stage.km / 2 ? stage.from : stage.to;
    const stamp = {
      id: crypto.randomUUID(),
      routeId: this.store.state().routeId,
      name,
      date: new Date().toISOString(),
    };
    this.store.patch({ stamps: [stamp, ...this.store.state().stamps] });
    this.stamped.set(true);
  }
}
