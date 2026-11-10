import type { StyleSpecification } from 'maplibre-gl';

const directory = 'data/offline/';
const ranges = ['0-255', '256-511', '8192-8447'];
interface OfflinePack {
  bytes: ArrayBuffer;
  start: number;
  offsets: Record<string, [number, number]>;
  glyphs: Map<string, ArrayBuffer>;
}

let pending: Promise<OfflinePack> | undefined;

async function read(file: string): Promise<ArrayBuffer> {
  const url = new URL(directory + file, document.baseURI).href;
  const cache = await globalThis.caches?.open('goperegrino-trail-pack-v1').catch(() => undefined);
  const existing = await cache?.match(url).catch(() => undefined);
  if (existing) return existing.arrayBuffer();
  const response = await fetch(url);
  if (!response.ok) throw new Error('Offline map: ' + file);
  const save = cache?.put(url, response.clone()).catch(() => undefined);
  const [bytes] = await Promise.all([response.arrayBuffer(), save]);
  return bytes;
}

export function loadOfflinePack(): Promise<OfflinePack> {
  pending ??= (async () => {
    const [bytes, ...fonts] = await Promise.all([
      read('trilhos.bin'),
      ...ranges.map((range) => read('noto-' + range + '.pbf')),
    ]);
    const start = 4 + new DataView(bytes).getUint32(0, true);
    const offsets = JSON.parse(new TextDecoder().decode(bytes.slice(4, start)));
    return { bytes, start, offsets, glyphs: new Map(ranges.map((range, i) => [range, fonts[i]])) };
  })().catch((error) => {
    pending = undefined;
    throw error;
  });
  return pending;
}

export async function offlineTile({ url }: { url: string }) {
  const key = url.replace('trailpack://', '');
  const pack = await loadOfflinePack();
  if (key.startsWith('glyphs/')) {
    return { data: pack.glyphs.get(key.split('/').at(-1) ?? '')?.slice(0) ?? new ArrayBuffer(0) };
  }
  const tile = pack.offsets[key];
  if (!tile) return { data: new ArrayBuffer(0) };
  const [offset, size] = tile;
  const bytes = new Uint8Array(pack.bytes, pack.start + offset, size);
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  return { data: await new Response(stream).arrayBuffer() };
}

export const offlineStyle: StyleSpecification = {
  version: 8,
  glyphs: 'trailpack://glyphs/{fontstack}/{range}',
  sources: {
    offline: {
      type: 'vector',
      tiles: ['trailpack://{z}/{x}/{y}'],
      minzoom: 7,
      maxzoom: 13,
      attribution:
        '<a href="https://openfreemap.org">OpenFreeMap</a> · © OpenMapTiles · <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    },
  },
  layers: [
    { id: 'base', type: 'background', paint: { 'background-color': '#f3f2e9' } },
    {
      id: 'landcover',
      type: 'fill',
      source: 'offline',
      'source-layer': 'landcover',
      paint: {
        'fill-color': ['match', ['get', 'class'], 'wood', '#d7e5d5', 'grass', '#e4eddb', '#eae9dc'],
      },
    },
    {
      id: 'landuse',
      type: 'fill',
      source: 'offline',
      'source-layer': 'landuse',
      filter: ['in', ['get', 'class'], ['literal', ['residential', 'commercial', 'industrial']]],
      paint: { 'fill-color': '#e9e6dd' },
    },
    {
      id: 'parks',
      type: 'fill',
      source: 'offline',
      'source-layer': 'park',
      paint: { 'fill-color': '#d9e7d7', 'fill-opacity': 0.75 },
    },
    {
      id: 'water',
      type: 'fill',
      source: 'offline',
      'source-layer': 'water',
      paint: { 'fill-color': '#acd2e6' },
    },
    {
      id: 'streams',
      type: 'line',
      source: 'offline',
      'source-layer': 'waterway',
      paint: {
        'line-color': '#8fbdd4',
        'line-width': ['interpolate', ['linear'], ['zoom'], 8, 0.7, 16, 2],
      },
    },
    {
      id: 'buildings',
      type: 'fill',
      source: 'offline',
      'source-layer': 'building',
      minzoom: 13,
      paint: { 'fill-color': '#d5cec1', 'fill-outline-color': '#c8bfb0' },
    },
    {
      id: 'roads-edge',
      type: 'line',
      source: 'offline',
      'source-layer': 'transportation',
      minzoom: 10,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': '#d8d3c4',
        'line-width': ['interpolate', ['linear'], ['zoom'], 10, 1.1, 17, 6],
      },
    },
    {
      id: 'roads',
      type: 'line',
      source: 'offline',
      'source-layer': 'transportation',
      minzoom: 10,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': [
          'match',
          ['get', 'class'],
          ['motorway', 'trunk', 'primary', 'secondary'],
          '#f8e4aa',
          '#fffdfa',
        ],
        'line-width': ['interpolate', ['linear'], ['zoom'], 10, 0.6, 17, 4.5],
      },
    },
    {
      id: 'towns',
      type: 'symbol',
      source: 'offline',
      'source-layer': 'place',
      layout: {
        'text-field': ['coalesce', ['get', 'name:latin'], ['get', 'name']],
        'text-font': ['Noto Sans Regular'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 7, 10, 15, 15],
        'symbol-sort-key': ['coalesce', ['get', 'rank'], 50],
      },
      paint: { 'text-color': '#29434b', 'text-halo-color': '#fffdf8', 'text-halo-width': 1.3 },
    },
  ],
};
