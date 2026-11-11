import { Component, computed, inject, input } from '@angular/core';
import { IonIcon } from '@ionic/angular';
import { Locale } from '../demo/locale';
import { PilgrimProfiles } from '../demo/pilgrim-profiles';
import { PilgrimAvatar } from './pilgrim-avatar';

@Component({
  selector: 'app-public-profile',
  imports: [IonIcon, PilgrimAvatar],
  template: `
    @if (profile(); as pilgrim) {
      <section class="profile-identity surface">
        <p class="kicker">{{ locale.t('publicProfile') }}</p>
        <app-pilgrim-avatar
          [name]="pilgrim.name"
          [photo]="pilgrim.photo"
          [color]="pilgrim.color"
          [size]="72"
        />
        <h2>{{ pilgrim.name }}</h2>
        <p class="profile-bio">{{ pilgrim.bio || locale.t('profileDefaultBio') }}</p>
        <div class="profile-stats">
          <div>
            <strong>{{ locale.number(pilgrim.walks) }}</strong
            ><small>{{ locale.t('completedWalks') }}</small>
          </div>
          <div>
            <strong>{{ locale.number(pilgrim.distance) }}</strong
            ><small>{{ locale.t('totalDistance') }}</small>
          </div>
          <div>
            <strong>{{ pilgrim.achievements.length }}</strong
            ><small>{{ locale.t('featuredAchievements') }}</small>
          </div>
        </div>
      </section>
      @if (pilgrim.achievements.length) {
        <h3>{{ locale.t('featuredAchievements') }}</h3>
        <div class="featured-badges">
          @for (badge of pilgrim.achievements; track badge.id) {
            <div class="featured-badge">
              <span class="badge-symbol"
                ><ion-icon [name]="badge.icon" aria-hidden="true"></ion-icon></span
              ><strong>{{ locale.t(badge.title) }}</strong>
            </div>
          }
        </div>
      }
    }
  `,
  styleUrls: ['./pilgrim-profile.scss'],
  styles: `
    h3 {
      font-size: 14px;
      margin: 0 0 12px;
    }
    .kicker {
      margin-top: 0;
      margin-bottom: 16px;
    }
  `,
})
export class PublicProfile {
  readonly profileId = input.required<string>();
  protected readonly locale = inject(Locale);
  private readonly profiles = inject(PilgrimProfiles);
  protected readonly profile = computed(() => this.profiles.get(this.profileId()));
}
