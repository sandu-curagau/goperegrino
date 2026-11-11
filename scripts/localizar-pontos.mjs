import { VectorTile } from '@mapbox/vector-tile';
import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { PbfReader } from 'pbf';

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

function buildingCenter(polygon) {
  const vertices = polygon[0].slice(0, -1);
  const center = vertices.reduce(
    ([x, y], [lon, lat]) => [x + lon / vertices.length, y + lat / vertices.length],
    [0, 0],
  );
  return insidePolygon(center, polygon) ? center.map((value) => Number(value.toFixed(6))) : null;
}

const zoom = 13;
const scale = 2 ** zoom;
function tileAt([lon, lat]) {
  return [
    Math.floor(((lon + 180) / 360) * scale),
    Math.floor(((1 - Math.asinh(Math.tan((lat * Math.PI) / 180)) / Math.PI) / 2) * scale),
  ];
}

function km([lon, lat], [x, y]) {
  return 111.2 * Math.hypot((x - lon) * Math.cos((lat * Math.PI) / 180), y - lat);
}

// Pick plausible demo locations using the land and building geometry already in the offline pack.
export async function locatePlaces(packPath, points, accommodations) {
  const pack = await readFile(packPath);
  const start = 4 + pack.readUInt32LE(0);
  const offsets = JSON.parse(pack.toString('utf8', 4, start));
  const cache = new Map();
  function tile(x, y) {
    const key = `${zoom}/${x}/${y}`;
    if (cache.has(key)) return cache.get(key);
    const entry = offsets[key];
    if (!entry) return { buildings: [], streets: [], water: [] };
    const [offset, size] = entry;
    const { layers } = new VectorTile(
      new PbfReader(gunzipSync(pack.subarray(start + offset, start + offset + size))),
    );
    function polygons(layer) {
      return Array.from(
        { length: layer?.length ?? 0 },
        (_, index) => layer.feature(index).toGeoJSON(x, y, zoom).geometry,
      ).flatMap(({ type, coordinates }) =>
        type === 'MultiPolygon' ? coordinates : type === 'Polygon' ? [coordinates] : [],
      );
    }
    const roads = layers.transportation;
    const streets = [];
    for (let index = 0; index < (roads?.length ?? 0); index++) {
      const feature = roads.feature(index);
      if (
        !['minor', 'service', 'tertiary', 'path'].includes(feature.properties.class) ||
        feature.properties.brunnel === 'bridge'
      )
        continue;
      const { type, coordinates } = feature.toGeoJSON(x, y, zoom).geometry;
      const lines =
        type === 'MultiLineString' ? coordinates : type === 'LineString' ? [coordinates] : [];
      for (const line of lines) {
        for (let i = 1; i < line.length; i++) {
          const middle = line[i].map((value, axis) =>
            Number(((value + line[i - 1][axis]) / 2).toFixed(6)),
          );
          streets.push(middle);
        }
      }
    }
    const value = {
      buildings: polygons(layers.building).map(buildingCenter).filter(Boolean),
      streets,
      water: polygons(layers.water),
    };
    cache.set(key, value);
    return value;
  }
  const occupied = new Map();
  for (const { routeId, location } of accommodations) {
    const { longitude, latitude } = location.coordinates;
    const positions = occupied.get(routeId) ?? [];
    positions.push([longitude, latitude]);
    occupied.set(routeId, positions);
  }

  for (const point of points) {
    const [x, y] = tileAt(point.coordinates);
    const tiles = [-1, 0, 1].flatMap((dx) => [-1, 0, 1].map((dy) => tile(x + dx, y + dy)));
    const water = tiles.flatMap((entry) => entry.water);
    const positions = occupied.get(point.routeId) ?? [];
    const nearby = (candidates) =>
      candidates
        .map((candidate) => ({ candidate, distance: km(point.coordinates, candidate) }))
        .filter(({ distance }) => distance <= 1)
        .sort((a, b) => a.distance - b.distance);
    const buildings = nearby(tiles.flatMap((entry) => entry.buildings));
    const streets = nearby(tiles.flatMap((entry) => entry.streets));
    const dry = (candidate) => !water.some((polygon) => insidePolygon(candidate, polygon));
    function separated(candidates, spacing) {
      return candidates.find(
        ({ candidate }) =>
          positions.every((position) => km(position, candidate) >= spacing) && dry(candidate),
      );
    }
    const match =
      separated(buildings, 0.065) ??
      separated(buildings, 0.035) ??
      separated(streets, 0.065) ??
      separated(streets, 0.025);
    if (!match) throw new Error(`No distinct mapped location for ${point.id}`);
    point.coordinates = match.candidate;
    positions.push(point.coordinates);
    occupied.set(point.routeId, positions);
  }
  return points;
}
