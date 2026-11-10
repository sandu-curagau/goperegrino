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
  addProtocol,
  AttributionControl,
  type GeoJSONSource,
  Map as LibreMap,
  Marker,
  Popup,
  setWorkerUrl,
} from 'maplibre-gl';
import type { Feature, FeatureCollection, LineString, Point as GeoPoint } from 'geojson';
import { DemoStore } from '../demo/demo-store';
import { Locale } from '../demo/locale';
import { lodgingPoint, Lodging, Point } from '../demo/models';
import { offlineStyle, offlineTile } from './offline-map';

type LodgingProperties = { id: string; partner: boolean };
const liberty = 'https://tiles.openfreemap.org/styles/liberty';
const roadShields = new Set([
  'highway-shield-non-us',
  'highway-shield-us-interstate',
  'road_shield_us',
]);
const stroke = { 'line-cap': 'round', 'line-join': 'round' } as const;
let protocolRegistered = false;

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
  template: `
    <div
      #canvas
      class="map-canvas"
      [attr.aria-label]="locale.t('mapLabel')"
      [class.ready]="ready()"
    ></div>
    @if (ready()) {
      <div class="zoom-controls">
        <button
          class="icon-button"
          type="button"
          [attr.aria-label]="locale.t('zoomIn')"
          (click)="zoom(1)"
        >
          +
        </button>
        <button
          class="icon-button"
          type="button"
          [attr.aria-label]="locale.t('zoomOut')"
          (click)="zoom(-1)"
        >
          −
        </button>
      </div>
    }
  `,
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
    .zoom-controls {
      position: absolute;
      top: clamp(167px, 37%, 220px);
      left: 12px;
      display: grid;
      overflow: hidden;
      border-radius: 12px;
      box-shadow: 0 2px 12px #173d4729;
      pointer-events: auto;
    }
    .zoom-controls button {
      width: 38px;
      height: 38px;
      border-radius: 0;
      font-size: 21px;
    }
    .zoom-controls button + button {
      border-top: 1px solid var(--line);
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
  readonly offline = input(false);
  readonly activePin = input<Lodging>();
  readonly selected = output<string>();
  readonly clearSelection = output<void>();
  readonly openDetails = output<void>();
  readonly mapReady = output<boolean>();

  private map?: LibreMap;
  private marker?: Marker;
  private resize?: ResizeObserver;
  private lastTarget?: Point;
  private lastRecenter = -1;
  private lastRevision = -1;
  private lastPosition?: Point;
  private following = true;
  private styleOffline = false;
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
      const offline = this.offline();
      if (!this.map || offline === this.styleOffline) return;
      this.styleOffline = offline;
      this.ready.set(false);
      this.armLoadingTimeout();
      this.map.setStyle(offline ? offlineStyle : liberty, { diff: false });
    });
    effect(() => {
      const position = this.store.progress().position;
      const target = this.target();
      const recenter = this.recenter();
      const revision = this.store.cameraRevision();
      const map = this.map;
      if (!this.ready() || !map || !position) return;

      this.marker?.setLngLat(position);
      const newTarget = target && target !== this.lastTarget;
      const explicit = revision !== this.lastRevision || recenter !== this.lastRecenter;
      if (newTarget) {
        this.following = false;
        map.jumpTo({ center: target, zoom: Math.max(15.5, map.getZoom()) });
      } else if (explicit || (this.following && position !== this.lastPosition)) {
        this.following = true;
        map.jumpTo({ center: position });
      }
      this.lastPosition = position;
      this.lastTarget = target;
      this.lastRevision = revision;
      this.lastRecenter = recenter;
    });
    effect((onCleanup) => {
      const item = this.activePin();
      const map = this.map;
      if (!item || !map || !this.ready()) return;
      this.following = false;
      const { popup, ring } = this.showPin(map, item);
      onCleanup(() => {
        popup.remove();
        ring.remove();
      });
    });
  }

  protected zoom(step: number): void {
    if (!this.map) return;
    this.following = false;
    this.map.easeTo({ zoom: this.map.getZoom() + step, duration: 180 });
  }

  private armLoadingTimeout(): void {
    clearTimeout(this.failedTimer);
    this.failedTimer = setTimeout(() => this.mapReady.emit(false), 10000);
  }

  private mount(): void {
    const canvas = this.canvas().nativeElement;
    const position = this.store.progress().position ?? [-8.611, 41.1428];
    setWorkerUrl(new URL('maplibre/maplibre-gl-worker.mjs', document.baseURI).href);
    if (!protocolRegistered) {
      addProtocol('trailpack', offlineTile);
      protocolRegistered = true;
    }
    this.styleOffline = this.offline();
    try {
      const map = (this.map = new LibreMap({
        container: canvas,
        style: this.styleOffline ? offlineStyle : liberty,
        center: position,
        zoom: 13.5,
        minZoom: 7,
        maxZoom: 18,
        pitchWithRotate: false,
        dragRotate: false,
        touchPitch: false,
        attributionControl: false,
        maxPitch: 0,
        transformStyle: (_previous, style) => ({
          ...style,
          layers: style.layers.filter(
            (layer) =>
              !roadShields.has(layer.id) &&
              (!('source-layer' in layer) || layer['source-layer'] !== 'poi'),
          ),
        }),
      }));
      map.touchZoomRotate.disableRotation();
      map.addControl(new AttributionControl({ compact: true }), 'bottom-left');
      this.resize = new ResizeObserver(() => {
        if (canvas.clientWidth && canvas.clientHeight) map.resize();
      });
      this.resize.observe(canvas);
      const dot = document.createElement('span');
      dot.className = 'walker-marker';
      this.marker = new Marker({ element: dot }).setLngLat(position).addTo(map);
      map.on('movestart', (event) => {
        if (event.originalEvent) this.following = false;
      });
      this.bindPinEvents(map);
      this.armLoadingTimeout();
      map.on('style.load', () => {
        clearTimeout(this.failedTimer);
        this.addLayers(map);
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

  private showPin(map: LibreMap, item: Lodging) {
    const position = lodgingPoint(item);
    const marker = document.createElement('span');
    marker.className = item.partner ? 'selected-stay-pin partner' : 'selected-stay-pin';
    marker.setAttribute('aria-hidden', 'true');
    const ring = new Marker({ element: marker }).setLngLat(position).addTo(map);

    const content = document.createElement('div');
    content.className = 'pin-summary';
    const type = document.createElement('small');
    type.className = 'kicker';
    type.textContent = item.partner ? this.locale.t('partner') : 'Booking.com';
    const name = document.createElement('strong');
    name.textContent = item.name;
    const price = document.createElement('span');
    price.textContent =
      this.locale.money(item.price) +
      ' / ' +
      this.locale.t('night') +
      ' · ★ ' +
      this.locale.number(item.review_score, 1);
    const details = document.createElement('button');
    details.type = 'button';
    details.className = 'primary';
    details.textContent = this.locale.t('detail');
    details.addEventListener('click', () => this.openDetails.emit());
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'pin-close';
    close.textContent = '×';
    close.setAttribute('aria-label', this.locale.t('close'));
    close.addEventListener('click', () => this.clearSelection.emit());
    content.append(type, name, price, details, close);
    const popup = new Popup({
      closeButton: false,
      closeOnClick: false,
      focusAfterOpen: false,
      offset: 15,
      maxWidth: '210px',
    })
      .setLngLat(position)
      .setDOMContent(content)
      .addTo(map);
    return { popup, ring };
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
  }

  private bindPinEvents(map: LibreMap): void {
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
