import { computed, inject, Injectable } from '@angular/core';
import { DemoStore } from './demo-store';
import { Locale, Message } from './locale';
import type { AvatarColor, PilgrimProfile } from './models';
import { sampleEntries, sampleWalk } from './sample-walk';

export const achievementDefinitions = [
  { id: 'finisher', title: 'achievementFinisher', icon: 'ribbon-outline', goal: 1 },
  { id: 'distance', title: 'achievementDistance', icon: 'footsteps-outline', goal: 100 },
  { id: 'journal', title: 'achievementJournal', icon: 'book-outline', goal: 5 },
  { id: 'photos', title: 'achievementPhotos', icon: 'camera-outline', goal: 5 },
  { id: 'community', title: 'achievementCommunity', icon: 'chatbubbles-outline', goal: 3 },
  { id: 'stamps', title: 'achievementStamps', icon: 'location-outline', goal: 5 },
] satisfies { id: string; title: Message; icon: string; goal: number }[];

export const communityPilgrims = [
  ['ines', 'Inês Martins', 'forest', 3, 784, 48],
  ['manuel', 'Manuel Costa', 'ocean', 5, 1260, 76],
  ['clara', 'Clara Silva', 'violet', 2, 460, 29],
  ['ana', 'Ana Ferreira', 'sunset', 1, 280, 18],
  ['rui', 'Rui Santos', 'ocean', 4, 940, 35],
  ['luis', 'Luís Pereira', 'forest', 2, 510, 24],
  ['teresa', 'Teresa Gomes', 'violet', 3, 720, 43],
  ['marta', 'Marta Oliveira', 'sunset', 1, 260, 12],
  ['joao', 'João Rodrigues', 'forest', 2, 430, 28],
  ['eva', 'Eva Lopes', 'violet', 1, 280, 16],
  ['miguel', 'Miguel Rocha', 'ocean', 4, 1080, 54],
  ['sofia', 'Sofia Almeida', 'sunset', 2, 560, 31],
] as const;

export interface PublicPilgrim extends Pick<PilgrimProfile, 'name' | 'bio' | 'photo' | 'color'> {
  id: string;
  walks: number;
  distance: number;
  achievements: typeof achievementDefinitions;
}

@Injectable({ providedIn: 'root' })
export class PilgrimProfiles {
  private readonly store = inject(DemoStore);
  private readonly locale = inject(Locale);
  readonly stats = computed(() => {
    const example = sampleWalk(this.store.routes());
    const active = this.store.activeWalk();
    const walks = [
      ...this.store.state().walkHistory,
      ...(active ? [active] : []),
      ...(example ? [example] : []),
    ];
    const unique = [...new Map(walks.map((walk) => [walk.id, walk])).values()];
    return {
      walks: unique.filter(
        (walk) =>
          walk.distance >=
          (this.store.routes().find((route) => route.id === walk.routeId)?.km ?? Infinity),
      ).length,
      distance: unique.reduce((sum, walk) => sum + walk.distance, 0),
      journal: this.store.journal().length + (example ? sampleEntries.length : 0),
      photos:
        this.store.journal().reduce((total, entry) => total + entry.photos.length, 0) +
        (example ? sampleEntries.filter((entry) => !!entry[2]).length : 0),
      community: this.store.state().trailComments.length,
      stamps: this.store.state().stamps.length,
    };
  });
  readonly achievements = computed(() => {
    const stats = this.stats();
    const counts = { ...stats, finisher: stats.walks };
    return achievementDefinitions.map((achievement) => ({
      ...achievement,
      progress: Math.min(achievement.goal, counts[achievement.id as keyof typeof counts]),
      unlocked: counts[achievement.id as keyof typeof counts] >= achievement.goal,
    }));
  });
  readonly unlocked = computed(() =>
    this.achievements().filter((achievement) => achievement.unlocked),
  );

  get(id: string): PublicPilgrim | undefined {
    if (id === 'self') {
      const profile = this.store.state().profile;
      const { walks, distance } = this.stats();
      return {
        id,
        name: profile.name,
        bio: profile.bio,
        photo: profile.photo,
        color: profile.color,
        walks,
        distance,
        achievements: this.unlocked().filter((achievement) =>
          profile.featuredAchievements.includes(achievement.id),
        ),
      };
    }
    const index = communityPilgrims.findIndex((entry) => entry[0] === id);
    const entry = communityPilgrims[index];
    if (!entry) return undefined;
    const [, name, color, walks, distance] = entry;
    const featured = ['finisher', 'distance', index % 2 ? 'community' : 'journal'];
    return {
      id,
      name,
      color: color as AvatarColor,
      walks,
      distance,
      photo: '',
      bio: this.locale.t(index % 2 ? 'communityBio2' : 'communityBio1'),
      achievements: achievementDefinitions.filter((achievement) =>
        featured.includes(achievement.id),
      ),
    };
  }
}
