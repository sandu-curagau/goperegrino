import { VectorTile } from '@mapbox/vector-tile';
import { fromVectorTileJs } from '@maplibre/vt-pbf';
import { PbfReader } from 'pbf';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';

const data = new URL('../public/data/', import.meta.url);
const offline = new URL('offline/', data);
const routes = JSON.parse(await readFile(new URL('caminhos.json', data), 'utf8'));
const tileJSON = await fetch('https://tiles.openfreemap.org/planet').then((response) =>
  response.json(),
);
const tileTemplate = tileJSON.tiles[0];
const userAgent = 'GoPeregrino-Academic-Prototype/1.0 (limited Iberian trail extract)';
const tiles = new Set();
const stops = new Map();

function tile([lon, lat], z) {
  const count = 2 ** z;
  return [
    Math.floor(((lon + 180) / 360) * count),
    Math.floor(((1 - Math.asinh(Math.tan((lat * Math.PI) / 180)) / Math.PI) / 2) * count),
  ];
}

function keys([lon, lat], z, buffer) {
  const [left, top] = tile([lon - buffer, lat + buffer], z);
  const [right, bottom] = tile([lon + buffer, lat - buffer], z);
  const result = [];
  for (let x = left; x <= right; x++) {
    for (let y = top; y <= bottom; y++) result.push(`${z}/${x}/${y}`);
  }
  return result;
}

for (const route of routes) {
  const trace = JSON.parse(await readFile(new URL(`tracados/${route.id}.geojson`, data), 'utf8'));
  for (const feature of trace.features) {
    for (const point of feature.geometry.coordinates) {
      for (let z = 7; z <= 13; z++) {
        for (const key of keys(point, z, z <= 10 ? 0.045 : 0.013)) tiles.add(key);
      }
    }
  }
  for (const stage of route.stages) {
    const id = stage.end.join(',');
    if (!stops.has(id)) stops.set(id, keys(stage.end, 14, 0.015));
  }
}

const allKeys = [...new Set([...tiles, ...[...stops.values()].flat()])].sort();
if (allKeys.length > 3000)
  throw new Error('O extrato ultrapassa o limite de pedidos do fornecedor.');
console.log(
  `A preparar ${tiles.size} tiles offline e ${allKeys.length - tiles.size} tiles para validar alojamentos.`,
);

const basemap = new Map();
const buildingTiles = new Map();
const layers = {
  water: [],
  waterway: ['class'],
  landcover: ['class'],
  landuse: ['class'],
  park: [],
  transportation: ['class', 'subclass', 'brunnel'],
  place: ['class', 'rank', 'name:latin', 'name'],
  building: [],
};
let completed = 0;
let cursor = 0;

async function download() {
  while (cursor < allKeys.length) {
    const key = allKeys[cursor++];
    const [z, x, y] = key.split('/').map(Number);
    const url = tileTemplate.replace('{z}', z).replace('{x}', x).replace('{y}', y);
    const response = await fetch(url, {
      headers: { 'User-Agent': userAgent },
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) throw new Error(`Tile ${key}: HTTP ${response.status}`);
    const vector = new VectorTile(new PbfReader(new Uint8Array(await response.arrayBuffer())));
    if (z === 14) {
      const polygons = (layer) =>
        Array.from(
          { length: layer?.length ?? 0 },
          (_, i) => layer.feature(i).toGeoJSON(x, y, z).geometry,
        ).flatMap((geometry) =>
          geometry.type === 'Polygon'
            ? [geometry.coordinates]
            : geometry.type === 'MultiPolygon'
              ? geometry.coordinates
              : [],
        );
      const road = vector.layers.transportation;
      const streets = [];
      for (let i = 0; i < (road?.length ?? 0); i++) {
        const feature = road.feature(i);
        if (
          !['minor', 'service', 'tertiary'].includes(feature.properties.class) ||
          feature.properties.brunnel === 'bridge'
        )
          continue;
        const geometry = feature.toGeoJSON(x, y, z).geometry;
        if (geometry.type === 'LineString') streets.push(...geometry.coordinates);
        if (geometry.type === 'MultiLineString') streets.push(...geometry.coordinates.flat());
      }
      buildingTiles.set(key, {
        buildings: polygons(vector.layers.building),
        water: polygons(vector.layers.water),
        streets,
      });
    } else {
      const selected = {};
      for (const [name, props] of Object.entries(layers)) {
        const layer = vector.layers[name];
        if (!layer) continue;
        const features = [];
        for (let i = 0; i < layer.length; i++) {
          const feature = layer.feature(i);
          if (
            name === 'place' &&
            !['city', 'town', 'village', 'suburb', 'hamlet'].includes(feature.properties.class)
          )
            continue;
          feature.properties = Object.fromEntries(
            props
              .filter((key) => key in feature.properties)
              .map((key) => [key, feature.properties[key]]),
          );
          features.push(feature);
        }
        if (features.length)
          selected[name] = {
            name,
            version: layer.version,
            extent: layer.extent,
            length: features.length,
            feature: (i) => features[i],
          };
      }
      basemap.set(key, gzipSync(fromVectorTileJs({ layers: selected }), { level: 5 }));
    }
    if (++completed % 100 === 0) console.log(`${completed}/${allKeys.length}`);
  }
}

await Promise.all(Array.from({ length: 4 }, download));

function insideRing([x, y], ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function insidePolygon(point, [outer, ...holes]) {
  return insideRing(point, outer) && !holes.some((hole) => insideRing(point, hole));
}

function roofPoint(polygon) {
  const ring = polygon[0].slice(0, -1);
  if (ring.length < 3) return undefined;
  const center = ring.reduce(
    ([x, y], point) => [x + point[0] / ring.length, y + point[1] / ring.length],
    [0, 0],
  );
  if (insidePolygon(center, polygon)) return center;
  for (const corner of ring) {
    const near = [(corner[0] * 2 + center[0]) / 3, (corner[1] * 2 + center[1]) / 3];
    if (insidePolygon(near, polygon)) return near;
  }
}

function distance([lon, lat], point) {
  return Math.hypot(
    (lon - point[0]) * 111.2 * Math.cos((lat * Math.PI) / 180),
    (lat - point[1]) * 111.2,
  );
}

const lodgingLocations = {};
for (const [id, keys] of stops) {
  const center = id.split(',').map(Number);
  const tiles = keys.map((key) => buildingTiles.get(key));
  const water = tiles.flatMap((tile) => tile.water);
  const nearby = (points) =>
    points
      .filter((point) => point && distance(center, point) < 1.5)
      .sort((a, b) => distance(center, a) - distance(center, b));
  const candidates = [
    ...nearby(tiles.flatMap((tile) => tile.buildings).map(roofPoint)),
    ...nearby(tiles.flatMap((tile) => tile.streets)),
  ];
  const locations = [];
  for (const separation of [0.11, 0.055, 0.022]) {
    for (const point of candidates) {
      const rounded = point.map((value) => Number(value.toFixed(6)));
      if (
        locations.every((other) => distance(rounded, other) >= separation) &&
        !water.some((polygon) => insidePolygon(rounded, polygon))
      )
        locations.push(rounded);
      if (locations.length === 10) break;
    }
    if (locations.length === 10) break;
  }
  if (locations.length !== 10) throw new Error(`Apenas ${locations.length} edifícios para ${id}.`);
  lodgingLocations[id] = locations;
}

const offsets = {};
const chunks = [];
let offset = 0;
for (const key of [...basemap.keys()].sort()) {
  const bytes = basemap.get(key);
  offsets[key] = [offset, bytes.length];
  chunks.push(bytes);
  offset += bytes.length;
}
if (offset > 50e6) throw new Error('O extrato ultrapassa 50 MB.');
await mkdir(offline, { recursive: true });
const directory = Buffer.from(JSON.stringify(offsets));
const size = Buffer.alloc(4);
size.writeUInt32LE(directory.length);
await writeFile(new URL('trilhos.bin', offline), Buffer.concat([size, directory, ...chunks]));
await writeFile(
  new URL('./alojamentos-locais.json', import.meta.url),
  JSON.stringify(lodgingLocations, null, 2) + '\n',
);
for (const range of ['0-255', '256-511', '8192-8447']) {
  const font = await fetch(
    `https://tiles.openfreemap.org/fonts/Noto%20Sans%20Regular/${range}.pbf`,
    {
      headers: { 'User-Agent': userAgent },
    },
  );
  if (!font.ok) throw new Error(`Fonte ${range}: HTTP ${font.status}`);
  await writeFile(new URL(`noto-${range}.pbf`, offline), Buffer.from(await font.arrayBuffer()));
}
console.log(
  `Mapa offline: ${(offset / 1e6).toFixed(1)} MB · ${Object.keys(lodgingLocations).length} localidades validadas`,
);
