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
  untracked,
  viewChild,
} from '@angular/core';
import {
  addProtocol,
  type GeoJSONSource,
  LngLatBounds,
  Map as LibreMap,
  Marker,
  Popup,
  setWorkerUrl,
} from 'maplibre-gl';
import type { Feature, FeatureCollection, LineString, Point as GeoPoint } from 'geojson';
import { DemoStore } from '../demo/demo-store';
import { Locale } from '../demo/locale';
import { kmBetween, lodgingPoint, Lodging, Point, type Waypoint } from '../demo/models';
import { offlineStyle, offlineTile } from './offline-map';
import type { MapComment } from './trail-comments';
import { CommentTranslation } from './comment-translation';
import type { PlannedStop } from './lodging-search';
import { mapPlaceKind, trailPlaceKinds, trailPlaces } from './trail-places';

type LodgingProperties = { id: string; partner: boolean };
const liberty = 'https://tiles.openfreemap.org/styles/liberty';
const roadShields = new Set([
  'highway-shield-non-us',
  'highway-shield-us-interstate',
  'road_shield_us',
]);
const stroke = { 'line-cap': 'round', 'line-join': 'round' } as const;
const flatCamera = { bearing: 0, pitch: 0, padding: { top: 0, bottom: 0, left: 0, right: 0 } };
const radians = Math.PI / 180;
const placePinLayers = ['trail-place-pin', 'trail-place-clusters'];
const lodgingPinLayers = ['lodging-pin', 'lodging-clusters'];
let protocolRegistered = false;

function headingTo(from: Point, to: Point): number {
  const east = (to[0] - from[0]) * Math.cos(from[1] * radians);
  return Math.atan2(east, to[1] - from[1]) / radians;
}

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

function placeFeatures(places: Waypoint[]): FeatureCollection<GeoPoint> {
  return {
    type: 'FeatureCollection',
    features: places.map((point) => {
      const kind = mapPlaceKind(point);
      return {
        type: 'Feature',
        properties: { id: point.id, kind, color: trailPlaces[kind].color },
        geometry: { type: 'Point', coordinates: point.coordinates },
      };
    }),
  };
}

async function loadPlaceIcons(): Promise<[string, ImageData][]> {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 32;
  const context = canvas.getContext('2d');
  if (!context) return [];
  const icons = await Promise.allSettled(
    trailPlaceKinds.map(async (kind): Promise<[string, ImageData]> => {
      const image = new Image();
      image.src = trailPlaces[kind].icon;
      await image.decode();
      context.clearRect(0, 0, 32, 32);
      context.globalCompositeOperation = 'source-over';
      context.drawImage(image, 0, 0, 32, 32);
      context.globalCompositeOperation = 'source-in';
      context.fillStyle = '#fff';
      context.fillRect(0, 0, 32, 32);
      return ['map-place-' + kind, context.getImageData(0, 0, 32, 32)];
    }),
  );
  return icons.flatMap((entry) => (entry.status === 'fulfilled' ? [entry.value] : []));
}

function lodgingIcon(): ImageData {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 36;
  const context = canvas.getContext('2d')!;
  context.scale(2, 2);
  context.strokeStyle = '#fff';
  context.lineWidth = 1.5;
  context.lineCap = 'round';
  context.lineJoin = 'round';
  context.beginPath();
  context.moveTo(1.5, 13.5);
  context.lineTo(1.5, 4.5);
  context.moveTo(1.5, 11.5);
  context.lineTo(16.5, 11.5);
  context.lineTo(16.5, 13.5);
  context.moveTo(4, 11.5);
  context.lineTo(4, 7.5);
  context.lineTo(14.5, 7.5);
  context.quadraticCurveTo(16.5, 7.5, 16.5, 9.5);
  context.lineTo(16.5, 11.5);
  context.moveTo(6.5, 7.5);
  context.lineTo(6.5, 11.5);
  context.stroke();
  return context.getImageData(0, 0, 36, 36);
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
  `,
})
export class TrailMap {
  protected readonly locale = inject(Locale);
  private readonly translation = inject(CommentTranslation);
  private readonly store = inject(DemoStore);
  private readonly canvas = viewChild.required<ElementRef<HTMLDivElement>>('canvas');
  protected readonly ready = signal(false);
  readonly pins = input<Lodging[]>([]);
  readonly target = input<Point>();
  readonly fitPoints = input<Point[]>([]);
  readonly fitTop = input(220);
  readonly stayHubs = input<PlannedStop[]>([]);
  readonly recenter = input(0);
  readonly zoomRequest = input<{ delta: number }>();
  readonly walkingView = input(false);
  readonly offline = input(false);
  readonly activePin = input<Lodging>();
  readonly comments = input<MapComment[]>([]);
  readonly activeComment = input<MapComment>();
  readonly places = input<Waypoint[]>([]);
  readonly nearbyPoint = input<Waypoint>();
  readonly navigationPoint = input<Point>();
  readonly navigationRotation = input(0);
  readonly selected = output<string>();
  readonly hubSelected = output<number>();
  readonly commentSelected = output<MapComment>();
  readonly placeSelected = output<Waypoint>();
  readonly profileSelected = output<string>();
  readonly openComments = output<void>();
  readonly clearSelection = output<void>();
  readonly openDetails = output<void>();
  readonly mapReady = output<boolean>();
  readonly followingChanged = output<boolean>();

  private map?: LibreMap;
  private marker?: Marker;
  private resize?: ResizeObserver;
  private lastTarget?: Point;
  private lastFit?: Point[];
  private lastRecenter = -1;
  private lastRevision = -1;
  private lastPosition?: Point;
  private lastWalking = false;
  private overviewZoom = 13.5;
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
  private readonly placeData = computed(() => placeFeatures(this.places()));
  private readonly placesById = computed(
    () => new Map(this.places().map((point) => [point.id, point])),
  );
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    effect(() => {
      const request = this.zoomRequest();
      if (request) this.zoom(request.delta);
    });
    effect((onCleanup) => {
      const point = this.nearbyPoint();
      const map = this.map;
      if (!this.ready() || !point || !map) return;
      this.setFollowing(false);
      const place = trailPlaces[mapPlaceKind(point)];
      const content = document.createElement('div');
      content.className = 'pin-summary';
      const kind = document.createElement('span');
      kind.className = 'kicker';
      kind.textContent = this.locale.t(point.kind === 'church' ? 'church' : place.label);
      const title = document.createElement('strong');
      title.textContent = point.location;
      const close = document.createElement('button');
      close.type = 'button';
      close.className = 'pin-close';
      close.textContent = '×';
      close.setAttribute('aria-label', this.locale.t('close'));
      close.onclick = () => this.clearSelection.emit();
      content.append(kind, title, close);
      const position = untracked(() => this.store.progress().position);
      if (position) {
        const distance = document.createElement('span');
        const km = kmBetween(position, point.coordinates);
        const label =
          km < 1 ? this.locale.number(km * 1000) + ' m' : this.locale.number(km, 1) + ' km';
        distance.textContent = this.locale.t('placeDistance', { distance: label });
        content.append(distance);
      }
      const pin = document.createElement('span');
      pin.className = 'selected-place-pin';
      pin.style.setProperty('--place-color', place.color);
      pin.setAttribute('aria-hidden', 'true');
      const icon = document.createElement('img');
      icon.src = place.icon;
      icon.alt = '';
      pin.append(icon);
      const marker = new Marker({ element: pin }).setLngLat(point.coordinates).addTo(map);
      const popup = new Popup({
        closeButton: false,
        closeOnClick: false,
        focusAfterOpen: false,
        offset: 22,
        anchor: this.target() ? (this.walkingView() ? 'bottom' : 'top') : undefined,
      })
        .setLngLat(point.coordinates)
        .setDOMContent(content)
        .addTo(map);
      onCleanup(() => {
        popup.remove();
        marker.remove();
      });
    });
    effect((onCleanup) => {
      const point = this.navigationPoint();
      const rotation = this.navigationRotation();
      const map = this.map;
      if (!this.ready() || !point || !map) return;
      const element = document.createElement('span');
      element.className = 'next-turn-pin';
      element.setAttribute('aria-hidden', 'true');
      const arrow = document.createElement('ion-icon');
      arrow.setAttribute('name', 'arrow-up-outline');
      arrow.style.transform = `rotate(${rotation}deg)`;
      element.append(arrow);
      const marker = new Marker({ element }).setLngLat(point).addTo(map);
      onCleanup(() => marker.remove());
    });
    afterNextRender(() => void this.mount());
    this.destroyRef.onDestroy(() => {
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
      const places = this.placeData();
      if (this.ready()) void this.map?.getSource<GeoJSONSource>('trail-places')?.setData(places);
    });
    effect(() => {
      const offline = this.offline();
      if (!this.map || offline === this.styleOffline) return;
      this.styleOffline = offline;
      this.map.setMinZoom(offline ? 7 : 6);
      this.ready.set(false);
      this.armLoadingTimeout();
      this.map.setStyle(offline ? offlineStyle : liberty, { diff: false });
    });
    effect(() => {
      const { position, partial } = this.store.progress();
      const walking = this.walkingView();
      const target = this.target();
      const points = this.fitPoints();
      const recenter = this.recenter();
      const revision = this.store.cameraRevision();
      const map = this.map;
      if (!this.ready() || !map || !position) return;

      const modeChanged = walking !== this.lastWalking;
      if (modeChanged && walking) this.overviewZoom = map.getZoom();
      const bearing = walking
        ? this.walkingHeading(position, partial.length - 1, map.getBearing())
        : 0;
      this.marker?.getElement().classList.toggle('heading', walking);
      this.marker?.setLngLat(position).setRotation(bearing);
      const newTarget = target && target !== this.lastTarget;
      const explicit = revision !== this.lastRevision || recenter !== this.lastRecenter;
      if (newTarget) {
        this.setFollowing(false);
        map.jumpTo({
          ...(walking ? { padding: this.walkingPadding(map) } : flatCamera),
          center: target,
          zoom: Math.max(15.5, map.getZoom()),
        });
      } else if (points.length && points !== this.lastFit) {
        this.setFollowing(false);
        map.jumpTo(flatCamera);
        const bounds = new LngLatBounds();
        for (const point of points) bounds.extend(point);
        map.fitBounds(bounds, {
          padding: {
            top: Math.min(this.fitTop(), map.getContainer().clientHeight - 115),
            bottom: 80,
            left: 32,
            right: 55,
          },
          maxZoom: 15,
          duration: 0,
        });
      } else if (modeChanged || explicit || (this.following && position !== this.lastPosition)) {
        this.setFollowing(true);
        if (walking) {
          const camera = {
            center: position,
            bearing,
            pitch: 43,
            padding: this.walkingPadding(map),
          };
          if (modeChanged || explicit) map.jumpTo({ ...camera, zoom: 16.8 });
          else map.easeTo({ ...camera, duration: 220 });
        } else {
          map.jumpTo({
            ...flatCamera,
            center: position,
            zoom: modeChanged ? this.overviewZoom : undefined,
          });
        }
      }
      this.lastPosition = position;
      this.lastTarget = target;
      this.lastFit = points;
      this.lastRevision = revision;
      this.lastRecenter = recenter;
      this.lastWalking = walking;
    });
    effect((onCleanup) => {
      const map = this.map;
      const hubs = this.stayHubs();
      if (!this.ready() || !map) return;
      const markers = hubs.map((stop) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'stay-hub-pin';
        button.textContent = stop.to;
        button.title = stop.to;
        button.setAttribute('aria-label', this.locale.t('staysAt', { name: stop.to }));
        button.addEventListener('click', () => this.hubSelected.emit(stop.stopId));
        return new Marker({ element: button, anchor: 'bottom', offset: [0, -16] })
          .setLngLat(stop.position)
          .addTo(map);
      });
      onCleanup(() => markers.forEach((marker) => marker.remove()));
    });
    effect((onCleanup) => {
      const item = this.activePin();
      const map = this.map;
      if (!this.ready() || !item || !map) return;
      this.setFollowing(false);
      const { popup, ring } = this.showPin(map, item);
      onCleanup(() => {
        popup.remove();
        ring.remove();
      });
    });
    effect((onCleanup) => {
      const map = this.map;
      const comments = this.comments();
      const selected = this.activeComment();
      if (!this.ready() || !map) return;
      const locale = this.locale.tag();
      let markers: Marker[] = [];
      const redraw = () => {
        markers.forEach((marker) => marker.remove());
        markers = this.addCommentMarkers(map, comments, selected?.id, locale);
      };
      redraw();
      map.on('zoomend', redraw);
      onCleanup(() => {
        map.off('zoomend', redraw);
        markers.forEach((marker) => marker.remove());
      });
    });
    effect((onCleanup) => {
      const map = this.map;
      const comment = this.activeComment();
      if (!this.ready() || !map || !comment) return;
      this.setFollowing(false);
      const popup = this.showComment(map, comment);
      onCleanup(() => popup.remove());
    });
  }

  protected zoom(step: number): void {
    if (!this.map) return;
    this.setFollowing(false);
    this.map.easeTo({ zoom: this.map.getZoom() + step, duration: 180 });
  }

  private setFollowing(following: boolean): void {
    if (this.following === following) return;
    this.following = following;
    this.followingChanged.emit(following);
  }

  private walkingPadding(map: LibreMap) {
    return { ...flatCamera.padding, top: Math.round(map.getContainer().clientHeight * 0.32) };
  }

  private walkingHeading(position: Point, index: number, fallback: number): number {
    const lines = this.store.geometry();
    const stage = this.store.stageIndex();
    const segments = [
      [lines[stage], Math.max(0, index)],
      [lines[stage + 1], 0],
    ] as const;
    let remaining = 0.035;
    let previous = position;
    for (const [line, start] of segments) {
      if (!line) continue;
      for (let i = start; i < line.length; i++) {
        const next = line[i];
        const length = kmBetween(previous, next);
        if (length >= remaining) {
          const part = remaining / length;
          const ahead: Point = [
            previous[0] + (next[0] - previous[0]) * part,
            previous[1] + (next[1] - previous[1]) * part,
          ];
          return kmBetween(position, ahead) > 0.002 ? headingTo(position, ahead) : fallback;
        }
        remaining -= length;
        previous = next;
      }
    }
    return kmBetween(position, previous) > 0.002 ? headingTo(position, previous) : fallback;
  }

  private armLoadingTimeout(): void {
    clearTimeout(this.failedTimer);
    this.failedTimer = setTimeout(() => this.mapReady.emit(false), 10000);
  }

  private async mount(): Promise<void> {
    const icons = await loadPlaceIcons();
    if (this.destroyRef.destroyed) return;
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
        minZoom: this.styleOffline ? 7 : 6,
        maxZoom: 18,
        pitchWithRotate: false,
        dragRotate: true,
        touchPitch: true,
        attributionControl: false,
        maxPitch: 48,
        transformStyle: (_previous, style) => ({
          ...style,
          layers: style.layers.filter(
            (layer) =>
              !roadShields.has(layer.id) &&
              (!('source-layer' in layer) || layer['source-layer'] !== 'poi'),
          ),
        }),
      }));
      this.resize = new ResizeObserver(() => {
        if (canvas.clientWidth && canvas.clientHeight) {
          map.resize();
          if (this.walkingView() && this.following) map.setPadding(this.walkingPadding(map));
        }
      });
      this.resize.observe(canvas);
      const dot = document.createElement('span');
      dot.className = 'walker-marker';
      this.marker = new Marker({
        element: dot,
        rotationAlignment: 'map',
        pitchAlignment: 'viewport',
      })
        .setLngLat(position)
        .addTo(map);
      this.followingChanged.emit(this.following);
      map.on('movestart', (event) => {
        if (event.originalEvent) this.setFollowing(false);
      });
      this.bindPinEvents(map);
      this.armLoadingTimeout();
      map.on('style.load', () => {
        clearTimeout(this.failedTimer);
        this.addLayers(map, icons);
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
      anchor: this.target() ? (this.walkingView() ? 'bottom' : 'top') : undefined,
      offset: 15,
      maxWidth: '210px',
    })
      .setLngLat(position)
      .setDOMContent(content)
      .addTo(map);
    return { popup, ring };
  }

  private showComment(map: LibreMap, comment: MapComment): Popup {
    const content = document.createElement('div');
    content.className = 'pin-summary comment-pin-summary';
    const location = document.createElement('small');
    location.className = 'kicker';
    location.textContent = comment.location;
    const author = document.createElement('button');
    author.type = 'button';
    author.className = 'comment-popup-author';
    author.textContent = comment.author;
    author.setAttribute('aria-label', this.locale.t('viewProfile', { name: comment.author }));
    const profileArrow = document.createElement('ion-icon');
    profileArrow.setAttribute('name', 'chevron-forward-outline');
    profileArrow.setAttribute('aria-hidden', 'true');
    author.append(profileArrow);
    author.addEventListener('click', () => this.profileSelected.emit(comment.authorId));
    const text = document.createElement('p');
    const translated = this.translation.view(comment);
    text.textContent = translated.message;
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'pin-close';
    close.textContent = '×';
    close.setAttribute('aria-label', this.locale.t('close'));
    close.addEventListener('click', () => this.clearSelection.emit());
    content.append(location, author, text, close);
    if (translated.visible) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'comment-popup-translation';
      button.textContent = this.locale.t(translated.action);
      button.disabled = translated.disabled;
      button.addEventListener('click', () => void this.translation.toggle(comment));
      content.append(button);
    }
    if (translated.error) {
      const status = document.createElement('small');
      status.setAttribute('role', 'status');
      status.textContent = this.locale.t(translated.error);
      content.append(status);
    }
    return new Popup({
      closeButton: false,
      closeOnClick: false,
      focusAfterOpen: false,
      anchor: this.target() ? (this.walkingView() ? 'bottom' : 'top') : undefined,
      offset: 17,
      maxWidth: '236px',
    })
      .setLngLat(comment.position)
      .setDOMContent(content)
      .addTo(map);
  }

  private addCommentMarkers(
    map: LibreMap,
    comments: MapComment[],
    selectedId: string | undefined,
    locale: string,
  ): Marker[] {
    const groups: { comment: MapComment; x: number; y: number; count: number }[] = [];
    for (const comment of comments) {
      const { x, y } = map.project(comment.position);
      const group =
        comment.id === selectedId
          ? undefined
          : groups.find(
              (entry) =>
                entry.comment.id !== selectedId && Math.hypot(entry.x - x, entry.y - y) < 29,
            );
      if (group) group.count++;
      else groups.push({ comment, x, y, count: 1 });
    }
    return groups.map(({ comment, count }) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'comment-map-pin';
      button.dataset['count'] = String(count);
      button.classList.toggle('is-selected', comment.id === selectedId);
      if (count > 1) {
        button.textContent = count.toLocaleString(locale);
        button.setAttribute('aria-label', this.locale.t('mapCommentCluster', { count }));
        button.addEventListener('click', () => {
          if (map.getZoom() >= map.getMaxZoom() - 0.1) this.openComments.emit();
          else {
            this.setFollowing(false);
            map.easeTo({
              center: comment.position,
              zoom: Math.min(map.getMaxZoom(), map.getZoom() + 2),
            });
          }
        });
      } else {
        button.setAttribute('aria-pressed', String(comment.id === selectedId));
        button.setAttribute(
          'aria-label',
          this.locale.t('mapCommentBy', { author: comment.author, location: comment.location }),
        );
        const icon = document.createElement('ion-icon');
        icon.setAttribute('name', 'chatbubbles-outline');
        icon.setAttribute('aria-hidden', 'true');
        button.append(icon);
        button.addEventListener('click', () => this.commentSelected.emit(comment));
      }
      return new Marker({ element: button }).setLngLat(comment.position).addTo(map);
    });
  }

  private addLayers(map: LibreMap, icons: [string, ImageData][]): void {
    map.addImage('stay-bed', lodgingIcon(), { pixelRatio: 2 });
    map.addSource('trail', { type: 'geojson', data: this.line() });
    map.addSource('walked', { type: 'geojson', data: this.walked() });
    map.addSource('trail-places', {
      type: 'geojson',
      data: this.placeData(),
      cluster: true,
      clusterRadius: 27,
      clusterMaxZoom: 15,
    });
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
    this.addPlaceLayers(map, icons);
    map.addLayer({
      id: 'lodging-clusters',
      type: 'circle',
      source: 'lodgings',
      filter: ['has', 'point_count'],
      paint: {
        'circle-color': '#003058',
        'circle-radius': 15,
        'circle-stroke-width': 3,
        'circle-stroke-color': '#fff',
      },
    });
    map.addLayer({
      id: 'lodging-pin',
      type: 'circle',
      source: 'lodgings',
      filter: ['!', ['has', 'point_count']],
      paint: {
        'circle-color': ['case', ['==', ['get', 'partner'], true], '#855600', '#0061a4'],
        'circle-radius': 12,
        'circle-stroke-width': 2,
        'circle-stroke-color': '#fff',
      },
    });
    map.addLayer({
      id: 'lodging-icons',
      type: 'symbol',
      source: 'lodgings',
      layout: {
        'icon-image': 'stay-bed',
        'icon-size': ['case', ['has', 'point_count'], 1.1, 0.85],
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
      },
    });
  }

  private addPlaceLayers(map: LibreMap, icons: [string, ImageData][]): void {
    for (const [name, icon] of icons) map.addImage(name, icon, { pixelRatio: 2 });
    map.addLayer({
      id: 'trail-place-clusters',
      type: 'circle',
      source: 'trail-places',
      filter: ['has', 'point_count'],
      paint: {
        'circle-color': '#246759',
        'circle-radius': 15,
        'circle-stroke-width': 3,
        'circle-stroke-color': '#fff',
      },
    });
    map.addLayer({
      id: 'trail-place-pin',
      type: 'circle',
      source: 'trail-places',
      filter: ['!', ['has', 'point_count']],
      paint: {
        'circle-color': ['get', 'color'],
        'circle-radius': 11,
        'circle-stroke-width': 2,
        'circle-stroke-color': '#fff',
      },
    });
    map.addLayer({
      id: 'trail-place-icons',
      type: 'symbol',
      source: 'trail-places',
      layout: {
        'icon-image': ['image', ['concat', 'map-place-', ['coalesce', ['get', 'kind'], 'picnic']]],
        'icon-size': 0.85,
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
      },
    });
  }

  private bindPinEvents(map: LibreMap): void {
    const layers = [...lodgingPinLayers, ...placePinLayers];
    map.on('click', async (event) => {
      const target = event.originalEvent.target;
      if (
        !this.ready() ||
        (target instanceof Element &&
          target.closest('.maplibregl-popup, .comment-map-pin, .stay-hub-pin'))
      )
        return;
      const [feature] = map.queryRenderedFeatures(event.point, { layers });
      const id = feature?.properties?.['id'];
      if (typeof id === 'string') {
        if (feature.source === 'trail-places') {
          const place = this.placesById().get(id);
          if (place) this.placeSelected.emit(place);
        } else this.selected.emit(id);
        return;
      }
      if (this.activePin() || this.activeComment() || this.nearbyPoint())
        this.clearSelection.emit();
      if (feature?.geometry.type !== 'Point') return;
      const center = feature.geometry.coordinates as Point;
      try {
        const zoom = await map
          .getSource<GeoJSONSource>(feature.source)
          ?.getClusterExpansionZoom(feature.properties?.['cluster_id']);
        if (zoom !== undefined) {
          this.setFollowing(false);
          map.easeTo({ center, zoom });
        }
      } catch {
        // The source may have changed while the cluster request was running.
      }
    });
    map.on('mouseenter', layers, () => (map.getCanvas().style.cursor = 'pointer'));
    map.on('mouseleave', layers, () => (map.getCanvas().style.cursor = ''));
  }
}
