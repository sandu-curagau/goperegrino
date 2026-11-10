import { Component, computed, inject } from '@angular/core';
import { DemoStore } from '../demo/demo-store';
import { Point } from '../demo/models';

@Component({
  selector: 'app-trail-sketch',
  template: `
    <svg viewBox="0 0 370 590" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <pattern id="map-grid" width="35" height="35" patternUnits="userSpaceOnUse">
          <path d="M35 0H0v35" fill="none" stroke="#dce6dd" stroke-width="1" />
        </pattern>
      </defs>
      <rect width="370" height="590" fill="#eef2e9" />
      <path d="M0 0h115c27 66 29 103 9 154C79 269 139 335 0 415Z" fill="#dfeade" />
      <path d="M370 258c-90 34-138 20-160 103s-83 69-114 122 11 84 24 107h250Z" fill="#dce9dc" />
      <path
        d="M345-30c19 88-87 146-63 219s25 86-15 146-61 87-31 159 77 64 60 125"
        fill="none"
        stroke="#d2e7ee"
        stroke-width="18"
      />
      <rect width="370" height="590" fill="url(#map-grid)" />
      <g fill="none" stroke-linecap="round" stroke-linejoin="round">
        @for (line of paths().route; track $index) {
          <polyline [attr.points]="line" stroke="#fff" stroke-width="8" />
          <polyline [attr.points]="line" stroke="#003058" stroke-width="4.5" />
        }
        @for (line of paths().walked; track $index) {
          <polyline [attr.points]="line" stroke="#f2a602" stroke-width="4.5" />
        }
      </g>
      @if (paths().position; as position) {
        <circle
          [attr.cx]="position[0]"
          [attr.cy]="position[1]"
          r="16"
          fill="#0068b8"
          opacity=".2"
        />
        <circle
          [attr.cx]="position[0]"
          [attr.cy]="position[1]"
          r="7"
          fill="#0068b8"
          stroke="white"
          stroke-width="2"
        />
      }
    </svg>
  `,
  styles: `
    :host,
    svg {
      position: absolute;
      inset: 0;
    }
    :host {
      bottom: var(--map-ad-height, 0px);
    }
    svg {
      width: 100%;
      height: 100%;
    }
  `,
})
export class TrailSketch {
  private readonly store = inject(DemoStore);
  private readonly projection = computed(() => {
    const route = this.store.geometry();
    const points = route.flatMap((segment) => segment.filter((_, index) => index % 8 === 0));
    const xs = points.map(([x]) => x);
    const ys = points.map(([, y]) => y);
    const west = Math.min(...xs);
    const north = Math.max(...ys);
    const width = Math.max(0.12, Math.max(...xs) - west);
    const height = Math.max(0.15, north - Math.min(...ys));
    return ([x, y]: Point): Point => [
      79 + ((x - west) / width) * 213,
      118 + ((north - y) / height) * 319,
    ];
  });
  protected readonly paths = computed(() => {
    const project = this.projection();
    const stage = this.store.stageIndex();
    const route = this.store.geometry();
    const { partial, position } = this.store.progress();
    const toPolyline = (points: Point[]) =>
      points
        .filter((_, index) => index % 6 === 0 || index === points.length - 1)
        .map((point) =>
          project(point)
            .map((coordinate) => coordinate.toFixed(1))
            .join(','),
        )
        .join(' ');
    return {
      route: route.map(toPolyline),
      walked: [...route.slice(0, stage), partial].map(toPolyline),
      position: position && project(position),
    };
  });
}
