import { Component, computed, input } from '@angular/core';
import type { AvatarColor } from '../demo/models';

@Component({
  selector: 'app-pilgrim-avatar',
  template: `
    <span
      [class]="color()"
      [style.width.px]="size()"
      [style.height.px]="size()"
      [style.font-size.px]="size() * 0.34"
      aria-hidden="true"
    >
      @if (photo()) {
        <img [src]="photo()" alt="" />
      } @else {
        {{ initials() }}
      }
    </span>
  `,
  styles: `
    :host {
      display: inline-flex;
      flex: none;
    }
    span {
      display: grid;
      place-items: center;
      overflow: hidden;
      border-radius: 34%;
      font-weight: 750;
      letter-spacing: -0.04em;
    }
    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .ocean {
      background: #dceaf1;
      color: #174763;
    }
    .forest {
      background: #e0eee3;
      color: #2b6246;
    }
    .sunset {
      background: #fce9d7;
      color: #985324;
    }
    .violet {
      background: #ece5f6;
      color: #72559b;
    }
  `,
})
export class PilgrimAvatar {
  readonly name = input.required<string>();
  readonly photo = input('');
  readonly color = input<AvatarColor>('ocean');
  readonly size = input(44);
  protected readonly initials = computed(() => {
    const words = this.name().trim().split(/\s+/);
    return (
      words.length > 1
        ? words
            .slice(0, 2)
            .map((word) => Array.from(word)[0])
            .join('')
        : Array.from(words[0]).slice(0, 2).join('')
    ).toLocaleUpperCase();
  });
}
