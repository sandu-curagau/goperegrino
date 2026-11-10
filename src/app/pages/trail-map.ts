import {
  afterNextRender,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import {
  AttributionControl,
  type GeoJSONSource,
  Map as LibreMap,
  Marker,
  setWorkerUrl,
} from 'maplibre-gl';
import type { Feature, FeatureCollection, LineString, Point as GeoPoint } from 'geojson';
import { DemoStore } from '../demo/demo-store';
import { Locale } from '../demo/locale';
import { lodgingPoint, Lodging, Point } from '../demo/models';

type LodgingProperties = { id: string; partner: boolean };
const liberty = 'https://tiles.openfreemap.org/styles/liberty';
const roadShields = new Set([
  'highway-shield-non-us',
  'highway-shield-us-interstate',
  'road_shield_us',
]);
const stroke = { 'line-cap': 'round', 'line-join': 'round' } as const;

function lineFeatures(lines: Point[][]): FeatureCollection<LineString> {
  return {
    type: 'FeatureCollection',
    features: lines
      .filter((coordinates) => coordinates.length > 1)
      .map((coordinates) => ({
        type: 'Feature',
        properties: {},
        geometry: { type: 'LineString', coordinates },
      })),
  };
}

function pinFeatures(lodgings: Lodging[]): FeatureCollection<GeoPoint, LodgingProperties> {
  return {
    type: 'FeatureCollection',
    features: lodgings.map((item) => ({
      type: 'Feature',
      properties: { id: item.id, partner: item.partner },
      geometry: { type: 'Point', coordinates: lodgingPoint(item) },
    })),
  };
}

@Component({
  selector: 'app-trail-map',
  template:
    '<div #canvas class="map-canvas" [attr.aria-label]="locale.t(\'mapLabel\')" [class.ready]="ready()"></div>',
  styles: `
    :host,
    .map-canvas {
      position: absolute;
      inset: 0;
    }
    .map-canvas {
      opacity: 0;
    }
    :host {
      bottom: var(--map-ad-height, 0px);
    }
    .map-canvas.ready {
      opacity: 1;
    }
    :host {
      pointer-events: none;
    }
    .map-canvas.ready {
      pointer-events: auto;
    }
  `,
})
export class TrailMap {
  protected readonly locale = inject(Locale);
  private readonly store = inject(DemoStore);
  private readonly canvas = viewChild.required<ElementRef<HTMLDivElement>>('canvas');
  protected readonly ready = signal(false);
  readonly pins = input<Lodging[]>([]);
  readonly target = input<Point>();
  readonly recenter = input(0);
  readonly selected = output<string>();
  readonly mapReady = output<boolean>();

  private map?: LibreMap;
  private marker?: Marker;
  private resize?: ResizeObserver;
  private lastCenter?: Point;
  private lastRecenter = -1;
  private failedTimer?: ReturnType<typeof setTimeout>;
  private readonly line = computed(() => lineFeatures(this.store.geometry()));
  private readonly walked = computed(() =>
    lineFeatures([
      ...this.store.geometry().slice(0, this.store.stageIndex()),
      this.store.progress().partial,
    ]),
  );
  private readonly lodgingData = computed(() => pinFeatures(this.pins()));

  constructor() {
    afterNextRender(() => this.mount());
    inject(DestroyRef).onDestroy(() => {
      clearTimeout(this.failedTimer);
      this.resize?.disconnect();
      this.map?.remove();
    });

    effect(() => {
      const line = this.line();
      if (this.ready()) void this.map?.getSource<GeoJSONSource>('trail')?.setData(line);
    });
    effect(() => {
      const walked = this.walked();
      if (this.ready()) void this.map?.getSource<GeoJSONSource>('walked')?.setData(walked);
    });
    effect(() => {
      const pins = this.lodgingData();
      if (this.ready()) void this.map?.getSource<GeoJSONSource>('lodgings')?.setData(pins);
    });
    effect(() => {
      const position = this.store.progress().position;
      const target = this.target();
      const recenter = this.recenter();
      const map = this.map;
      if (!this.ready() || !map || !position) return;

      this.marker?.setLngLat(position);
      const center = target ?? position;
      if (center !== this.lastCenter || recenter !== this.lastRecenter) {
        this.lastCenter = center;
        this.lastRecenter = recenter;
        map.jumpTo({ center });
      }
    });
  }

  private mount(): void {
    const canvas = this.canvas().nativeElement;
    const position = this.store.progress().position ?? [-8.611, 41.1428];
    setWorkerUrl(new URL('maplibre/maplibre-gl-worker.mjs', document.baseURI).href);
    try {
      const map = (this.map = new LibreMap({
        container: canvas,
        style: liberty,
        center: position,
        zoom: 13.5,
        pitchWithRotate: false,
        dragRotate: false,
        touchPitch: false,
        attributionControl: false,
        maxPitch: 0,
        transformStyle: (_previous, style) => ({
          ...style,
          layers: style.layers.filter((layer) => !roadShields.has(layer.id)),
        }),
      }));
      map.touchZoomRotate.disableRotation();
      map.addControl(new AttributionControl({ compact: true }), 'bottom-left');
      this.resize = new ResizeObserver(() => {
        if (canvas.clientWidth && canvas.clientHeight) map.resize();
      });
      this.resize.observe(canvas);
      this.failedTimer = setTimeout(() => this.mapReady.emit(false), 7000);
      map.once('load', () => {
        clearTimeout(this.failedTimer);
        this.addLayers(map);
        const dot = document.createElement('span');
        dot.className = 'walker-marker';
        this.marker = new Marker({ element: dot }).setLngLat(position).addTo(map);
        this.ready.set(true);
        this.mapReady.emit(true);
      });
      map.on('error', () => {
        if (!this.ready()) this.mapReady.emit(false);
      });
    } catch {
      this.mapReady.emit(false);
    }
  }

  private addLayers(map: LibreMap): void {
    map.addSource('trail', { type: 'geojson', data: this.line() });
    map.addSource('walked', { type: 'geojson', data: this.walked() });
    map.addSource('lodgings', {
      type: 'geojson',
      data: this.lodgingData(),
      cluster: true,
      clusterRadius: 25,
      clusterMaxZoom: 15,
    });

    map.addLayer({
      id: 'trail-edge',
      type: 'line',
      source: 'trail',
      layout: stroke,
      paint: { 'line-color': '#fff', 'line-width': 8 },
    });
    map.addLayer({
      id: 'trail-line',
      type: 'line',
      source: 'trail',
      layout: stroke,
      paint: { 'line-color': '#003058', 'line-width': 5 },
    });
    map.addLayer({
      id: 'walked-line',
      type: 'line',
      source: 'walked',
      layout: stroke,
      paint: { 'line-color': '#f2a602', 'line-width': 5 },
    });
    map.addLayer({
      id: 'lodging-clusters',
      type: 'circle',
      source: 'lodgings',
      filter: ['has', 'point_count'],
      paint: {
        'circle-color': '#003058',
        'circle-radius': 14,
        'circle-stroke-width': 2,
        'circle-stroke-color': '#fff',
      },
    });
    map.addLayer({
      id: 'lodging-count',
      type: 'symbol',
      source: 'lodgings',
      filter: ['has', 'point_count'],
      layout: {
        'text-field': '{point_count_abbreviated}',
        'text-size': 11,
        'text-font': ['Noto Sans Regular'],
      },
      paint: { 'text-color': '#fff' },
    });
    map.addLayer({
      id: 'lodging-pin',
      type: 'circle',
      source: 'lodgings',
      filter: ['!', ['has', 'point_count']],
      paint: {
        'circle-color': ['case', ['==', ['get', 'partner'], true], '#f2a602', '#0061a4'],
        'circle-radius': 8,
        'circle-stroke-width': 2,
        'circle-stroke-color': '#fff',
      },
    });

    map.on('click', 'lodging-pin', (event) => {
      const id = event.features?.[0]?.properties?.['id'];
      if (typeof id === 'string') this.selected.emit(id);
    });
    map.on('click', 'lodging-clusters', async (event) => {
      const feature = event.features?.[0];
      if (feature?.geometry.type !== 'Point') return;
      const center = feature.geometry.coordinates as Point;
      try {
        const zoom = await map
          .getSource<GeoJSONSource>('lodgings')
          ?.getClusterExpansionZoom(feature.properties?.['cluster_id']);
        if (zoom) map.easeTo({ center, zoom });
      } catch {
        // The source may have changed while the cluster request was running.
      }
    });
    for (const layer of ['lodging-pin', 'lodging-clusters']) {
      map.on('mouseenter', layer, () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', layer, () => {
        map.getCanvas().style.cursor = '';
      });
    }
  }
}
