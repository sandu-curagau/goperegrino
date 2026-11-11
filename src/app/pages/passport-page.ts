import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { IonContent, IonIcon } from '@ionic/angular';
import { DemoStore } from '../demo/demo-store';
import { Locale } from '../demo/locale';
import { dateInput, kmBetween, Stamp, Waypoint } from '../demo/models';
import { Sheet } from '../demo/sheet';

@Component({
  imports: [IonContent, IonIcon, Sheet],
  template: `
    <ion-content>
      <main class="page">
        <header class="page-heading">
          <button class="text-button" type="button" (click)="back()">
            <ion-icon name="chevron-back-outline" aria-hidden="true"></ion-icon
            >{{ locale.t('caminho') }}
          </button>
          <p class="kicker">{{ store.route()?.name }}</p>
          <h1>{{ locale.t('credencial') }}</h1>
          <p>{{ locale.t('stampCopy') }}</p>
        </header>

        <section class="passport">
          <ion-icon name="ribbon-outline" aria-hidden="true"></ion-icon>
          <div>
            <strong>{{ stamps().length }}</strong>
            <span>{{ locale.t('recordedStamps') }}</span>
          </div>
          <div>
            <strong>{{ stampCount() }}</strong>
            <span>{{ locale.t('today') }}</span>
          </div>
        </section>

        <button class="primary wide stamp-action" type="button" (click)="showSpots.set(true)">
          <ion-icon name="location-outline" aria-hidden="true"></ion-icon
          >{{ locale.t('stampSpots') }}
        </button>
        @if (stamped(); as name) {
          <p class="stamp-status" role="status">{{ locale.t('stampSavedAt', { name }) }}</p>
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

        @if (store.route()?.destination === 'Santiago') {
          <aside class="surface passport-help">
            <strong>{{ locale.t('officialCredential') }}</strong>
            <p>{{ locale.t('compostela') }}</p>
            <a
              href="https://oficinadelperegrino.com/en/ufaq/where-can-i-get-the-credencial-del-peregrino/"
              target="_blank"
              rel="noopener"
              >{{ locale.t('pilgrimOffice') }}</a
            >
          </aside>
        }
      </main>
    </ion-content>

    @if (showSpots()) {
      <app-sheet [title]="locale.t('stampSpots')" (closed)="showSpots.set(false)">
        <div class="sheet-stack">
          <p class="muted spots-intro">{{ locale.t('stampHow') }}</p>
          @for (spot of spots(); track spot.id) {
            <div class="surface stamp-spot">
              <div>
                <strong>{{ spotName(spot) }}</strong>
                <small>{{
                  locale.t('distanceAway', { km: locale.number(spot.distance, 1) })
                }}</small>
              </div>
              @if (recordedPoints().has(spot.id)) {
                <span class="tag">{{ locale.t('stampAdded') }}</span>
              } @else {
                <button
                  class="secondary"
                  type="button"
                  [attr.aria-label]="locale.t('stampAt', { name: spotName(spot) })"
                  (click)="stamp(spot)"
                >
                  {{ locale.t('recordStamp') }}
                </button>
              }
            </div>
          }
        </div>
      </app-sheet>
    }
  `,
  styles: `
    .passport {
      display: grid;
      grid-template-columns: auto 1.2fr 1fr;
      align-items: center;
      gap: 13px;
      padding: 16px;
      border-radius: 19px;
      background: radial-gradient(ellipse at 100% 0%, #24617a, #003058 73%);
      color: white;
    }
    .passport strong {
      display: block;
      font-size: 32px;
    }
    .passport span {
      font-size: 11px;
      color: #e1eaf3;
    }
    .passport ion-icon {
      color: #ffdc74;
      font-size: 37px;
    }
    .stamp-action {
      margin: 11px 0;
    }
    .stamp-status {
      color: var(--link);
      font-size: 13px;
    }
    .passport-help,
    .stamp-spot {
      padding: 12px;
      font-size: 13px;
    }
    .passport-help {
      margin-top: 14px;
    }
    .passport-help p,
    .spots-intro {
      margin: 5px 0;
      color: var(--muted);
    }
    .passport-help a {
      color: var(--link);
    }
    .stamp-spot {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }
    .stamp-spot small {
      display: block;
      margin-top: 4px;
      color: var(--muted);
    }
  `,
})
export class PassportPage {
  protected readonly store = inject(DemoStore);
  protected readonly locale = inject(Locale);
  private readonly router = inject(Router);

  protected back(): void {
    void this.router.navigateByUrl('/caminho');
  }
  protected readonly stamped = signal('');
  protected readonly showSpots = signal(false);
  protected readonly stamps = computed(() =>
    this.store
      .state()
      .stamps.filter(
        (stamp) =>
          stamp.routeId === this.store.route()?.id &&
          (!stamp.walkId || stamp.walkId === this.store.state().walkId),
      ),
  );
  protected readonly recordedPoints = computed(
    () => new Set(this.stamps().map((stamp) => stamp.pointId)),
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
  protected readonly spots = computed(() => {
    const position = this.store.progress().position;
    const route = this.store.route();
    if (!position || !route) return [];
    return this.store
      .points()
      .filter(
        (point) =>
          point.routeId === route.id && (point.kind === 'stamp' || point.kind === 'church'),
      )
      .map((point) => ({ ...point, distance: kmBetween(position, point.coordinates) }))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 6);
  });

  protected spotName(point: Waypoint): string {
    return this.locale.t(point.kind === 'church' ? 'churchStampAt' : 'stampPointAt', {
      name: point.location,
    });
  }

  protected time(value: string): string {
    return new Intl.DateTimeFormat(this.locale.tag(), {
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(value));
  }

  protected stamp(point: Waypoint): void {
    const state = this.store.state();
    if (point.routeId !== state.routeId || this.recordedPoints().has(point.id)) return;
    const name = this.spotName(point);
    const stamp: Stamp = {
      id: crypto.randomUUID(),
      routeId: state.routeId,
      walkId: state.walkId,
      pointId: point.id,
      name,
      date: new Date().toISOString(),
    };
    this.store.patch({ stamps: [stamp, ...state.stamps] });
    this.stamped.set(name);
    this.showSpots.set(false);
  }
}
