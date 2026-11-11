import {
  Component,
  ElementRef,
  computed,
  inject,
  Injectable,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { IonIcon } from '@ionic/angular';
import { DemoStore } from '../demo/demo-store';
import { Locale } from '../demo/locale';
import { kmBetween, Point, TrailComment } from '../demo/models';
import { communityPilgrims, PilgrimProfiles } from '../demo/pilgrim-profiles';
import { PilgrimAvatar } from './pilgrim-avatar';
import { PublicProfile } from './public-profile';

const pageSize = 10;
const tips = [
  ['Inês', 'trailTip1', 38, 32],
  ['Manuel', 'trailTip2', 17, 55],
  ['Clara', 'trailTip3', 42, 85],
  ['Ana', 'trailTip4', 29, 120],
  ['Rui', 'trailTip5', 12, 160],
  ['Luís', 'trailTip6', 34, 225],
  ['Teresa', 'trailTip7', 6, 300],
  ['Marta', 'trailTip8', 23, 380],
  ['João', 'trailTip9', 9, 460],
  ['Eva', 'trailTip10', 3, 540],
  ['Miguel', 'trailTip11', 19, 660],
  ['Sofia', 'trailTip12', 7, 810],
] as const;

export type MapComment = Pick<TrailComment, 'id' | 'position' | 'message' | 'location'> & {
  author: string;
  authorId: string;
  score: number;
};

@Injectable()
export class TrailCommentFeed {
  private readonly store = inject(DemoStore);
  private readonly locale = inject(Locale);
  readonly position = signal<Point | undefined>(undefined);
  readonly radius = signal(1000);
  readonly sort = signal<'liked' | 'newest'>('liked');
  readonly showPins = signal(false);
  readonly mapLimit = 15;
  private readonly comments = computed(() => this.store.state().trailComments);
  private readonly likedIds = computed(() => this.store.state().likedTrailComments);
  private readonly distanceBucket = computed(() => Math.floor(this.store.state().distance * 5));

  private readonly examples = computed(() => {
    const route = this.store.route();
    const geometry = this.store.geometry();
    return (
      route?.stages.flatMap((stage, stageIndex) => {
        const geometryLine = geometry[stageIndex];
        const line = geometryLine?.length >= 2 ? geometryLine : [stage.start, stage.end];
        const lengths = line.slice(1).map((point, index) => kmBetween(line[index], point) * 1000);
        const total = lengths.reduce((sum, length) => sum + length, 0);
        const extra = Array.from(
          { length: Math.max(0, Math.ceil((total - 1150) / 650)) },
          (_, index) => {
            const [author, message, votes] = tips[(index + stage.id * 3) % tips.length];
            return [author, message, Math.max(1, votes - (index % 9)), 1150 + index * 650] as const;
          },
        );
        let segment = 1;
        let walked = 0;
        let length = lengths[0];
        return [...tips, ...extra].map(([author, message, votes, offset], index) => {
          const pilgrim = communityPilgrims.find((entry) => entry[1].startsWith(author + ' '))!;
          while (walked + length < offset && segment < line.length - 1) {
            walked += length;
            segment++;
            length = lengths[segment - 1];
          }
          const fraction = length ? Math.min(1, (offset - walked) / length) : 0;
          const [a, b] = [line[segment - 1], line[segment]];
          const position: Point = [
            a[0] + (b[0] - a[0]) * fraction,
            a[1] + (b[1] - a[1]) * fraction,
          ];
          return {
            id: `demo-${route.id}-${stage.id}-${index}`,
            position,
            location: index < tips.length ? stage.from : stage.from + ' → ' + stage.to,
            author: pilgrim[1],
            authorId: pilgrim[0],
            message: this.locale.t(message),
            createdAt: new Date(Date.UTC(2025, 8, 1 + index)).toISOString(),
            votes,
          };
        });
      }) ?? []
    );
  });

  readonly results = computed(() => {
    const position = this.position();
    const routeId = this.store.route()?.id;
    if (!position || !routeId) return [];
    const likes = new Set(this.likedIds());
    const radius = this.radius();
    const own = this.comments()
      .filter((item) => item.routeId === routeId)
      .map((item) => ({
        ...item,
        author: this.store.state().profile.name,
        authorId: 'self',
        votes: 0,
      }));
    const newest = this.sort() === 'newest';
    return [...this.examples(), ...own]
      .map((comment) => {
        const liked = likes.has(comment.id);
        return {
          ...comment,
          metres: kmBetween(position, comment.position) * 1000,
          liked,
          score: comment.votes + Number(liked),
        };
      })
      .filter((comment) => comment.metres <= radius)
      .sort(
        (a, b) =>
          (newest ? 0 : b.score - a.score) ||
          b.createdAt.localeCompare(a.createdAt) ||
          a.metres - b.metres,
      );
  });
  updatePosition(): void {
    this.position.set(this.store.progress().position);
  }

  updateMapPosition(): void {
    this.distanceBucket();
    this.store.geometry();
    untracked(() => this.updatePosition());
  }
}

@Component({
  selector: 'app-trail-comments',
  imports: [IonIcon, PilgrimAvatar, PublicProfile],
  templateUrl: './trail-comments.html',
  styleUrl: './trail-comments.scss',
})
export class TrailComments {
  protected readonly store = inject(DemoStore);
  protected readonly locale = inject(Locale);
  protected readonly feed = inject(TrailCommentFeed);
  protected readonly profiles = inject(PilgrimProfiles);
  private readonly element = inject(ElementRef<HTMLElement>);
  protected readonly viewingProfile = signal<string | null>(null);
  private commentScroll = 0;
  protected readonly radii = [100, 500, 1000, 5000];
  protected readonly limit = signal(pageSize);
  protected readonly writing = signal(false);
  protected readonly draft = signal('');
  protected readonly visible = computed(() => this.feed.results().slice(0, this.limit()));
  readonly showOnMap = output<MapComment>();
  readonly layerChanged = output<boolean>();
  readonly profileViewing = output<boolean>();
  readonly mapAvailable = input(true);

  protected inspectProfile(id: string): void {
    const dialog = this.element.nativeElement.closest('dialog');
    this.commentScroll = dialog?.scrollTop ?? 0;
    this.viewingProfile.set(id);
    this.profileViewing.emit(true);
    dialog?.scrollTo({ top: 0 });
  }

  protected backToComments(): void {
    this.viewingProfile.set(null);
    this.profileViewing.emit(false);
    requestAnimationFrame(() =>
      this.element.nativeElement.closest('dialog')?.scrollTo({ top: this.commentScroll }),
    );
  }

  protected togglePins(): void {
    const visible = !this.feed.showPins();
    this.feed.showPins.set(visible);
    this.layerChanged.emit(visible);
  }

  protected distance(metres: number): string {
    return metres < 1000
      ? this.locale.number(metres) + ' m'
      : this.locale.number(metres / 1000, 1) + ' km';
  }

  protected setRadius(radius: number): void {
    this.feed.radius.set(radius);
    this.limit.set(pageSize);
  }

  protected setSort(sort: string): void {
    this.feed.sort.set(sort === 'newest' ? 'newest' : 'liked');
    this.limit.set(pageSize);
  }

  protected showMore(): void {
    this.limit.update((count) => count + pageSize);
  }

  protected toggleLike(id: string): void {
    if (this.store.offline()) return;
    this.store.toggleTrailCommentLike(id);
  }

  protected post(): void {
    const message = this.draft().trim();
    const stage = this.store.stage();
    const position = this.store.progress().position;
    const routeId = this.store.route()?.id;
    if (this.store.offline() || !message || !position || !stage || !routeId) return;
    this.store.addTrailComment({
      routeId,
      position,
      location: this.store.completed() ? stage.to : stage.from + ' → ' + stage.to,
      message,
    });
    this.feed.position.set(position);
    this.draft.set('');
    this.writing.set(false);
    this.setSort('newest');
  }
}
