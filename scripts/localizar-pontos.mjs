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
const localRoads = ['minor', 'service', 'tertiary', 'path'];
const trailRoads = [...localRoads, 'track', 'residential'];
function tileAt([lon, lat]) {
  return [
    Math.floor(((lon + 180) / 360) * scale),
    Math.floor(((1 - Math.asinh(Math.tan((lat * Math.PI) / 180)) / Math.PI) / 2) * scale),
  ];
}

function km([lon, lat], [x, y]) {
  return 111.2 * Math.hypot((x - lon) * Math.cos((lat * Math.PI) / 180), y - lat);
}

function* sampleStage(line) {
  const distances = [0];
  for (let index = 1; index < line.length; index++) {
    distances.push(distances[index - 1] + km(line[index - 1], line[index]));
  }
  const total = distances.at(-1);
  if (!total) return;
  const samples = Math.ceil(total / 0.85);
  let next = 1;
  for (let index = 0; index < samples; index++) {
    const distance = ((index + 0.5) * total) / samples;
    while (distances[next] <= distance) next++;
    const ratio = (distance - distances[next - 1]) / (distances[next] - distances[next - 1]);
    const center = line[next - 1].map((value, axis) => value + (line[next][axis] - value) * ratio);
    yield { center, fraction: distance / total, index };
  }
}

function serviceKinds(buildingCount, seed) {
  const kinds = [seed % 3 === 0 ? 'picnic' : 'water'];
  if (buildingCount < 3) return kinds;
  kinds.push('cafe', seed % 3 === 0 ? 'toilet' : 'restaurant');
  if (buildingCount >= 7) {
    kinds.push('market', seed % 2 === 0 || kinds[0] === 'picnic' ? 'transit' : 'picnic');
  }
  if (buildingCount >= 12) kinds.push(seed % 2 === 0 ? 'stamp' : 'monument');
  if (buildingCount >= 22) {
    const townServices = ['pharmacy', 'souvenir', 'postOffice', 'wellness', 'credentialShop'];
    kinds.push(townServices[seed % townServices.length]);
    if (buildingCount >= 45) kinds.push(townServices[(seed + 2) % townServices.length]);
  }
  return kinds;
}

// Pick plausible demo locations using the land and building geometry already in the offline pack.
export async function locatePlaces(packPath, points, accommodations, stages) {
  const pack = await readFile(packPath);
  const start = 4 + pack.readUInt32LE(0);
  const offsets = JSON.parse(pack.toString('utf8', 4, start));
  const cache = new Map();
  function tile(x, y) {
    const key = `${zoom}/${x}/${y}`;
    if (cache.has(key)) return cache.get(key);
    const entry = offsets[key];
    if (!entry) return { buildings: [], streets: [], water: [], settlements: [] };
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
      if (!trailRoads.includes(feature.properties.class) || feature.properties.brunnel === 'bridge')
        continue;
      const { type, coordinates } = feature.toGeoJSON(x, y, zoom).geometry;
      const lines =
        type === 'MultiLineString' ? coordinates : type === 'LineString' ? [coordinates] : [];
      for (const line of lines) {
        for (let i = 1; i < line.length; i++) {
          const middle = line[i].map((value, axis) =>
            Number(((value + line[i - 1][axis]) / 2).toFixed(6)),
          );
          streets.push({ position: middle, local: localRoads.includes(feature.properties.class) });
        }
      }
    }
    const settlements = [];
    const places = layers.place;
    for (let index = 0; index < (places?.length ?? 0); index++) {
      const feature = places.feature(index);
      const name = feature.properties['name:latin'] || feature.properties.name;
      const geometry = feature.toGeoJSON(x, y, zoom).geometry;
      if (name && geometry.type === 'Point')
        settlements.push({ name, position: geometry.coordinates });
    }
    const value = {
      buildings: polygons(layers.building).map(buildingCenter).filter(Boolean),
      streets,
      water: polygons(layers.water),
      settlements,
    };
    cache.set(key, value);
    return value;
  }
  const occupied = new Map();
  const lodgingPositions = new Map();
  for (const { routeId, location } of accommodations) {
    const { longitude, latitude } = location.coordinates;
    const positions = lodgingPositions.get(routeId) ?? [];
    positions.push([longitude, latitude]);
    lodgingPositions.set(routeId, positions);
  }
  for (const [routeId, positions] of lodgingPositions) occupied.set(routeId, [...positions]);

  function near(center, radius, includeTracks = true) {
    const [x, y] = tileAt(center);
    const tiles = [-1, 0, 1].flatMap((dx) => [-1, 0, 1].map((dy) => tile(x + dx, y + dy)));
    const water = tiles.flatMap((entry) => entry.water);
    const nearby = (candidates) =>
      candidates
        .map((position) => ({ position, distance: km(center, position) }))
        .filter(({ distance }) => distance <= radius)
        .sort((a, b) => a.distance - b.distance)
        .map(({ position }) => position);
    return {
      buildings: nearby(tiles.flatMap((entry) => entry.buildings)),
      streets: nearby(
        tiles.flatMap((entry) =>
          entry.streets
            .filter((street) => includeTracks || street.local)
            .map((street) => street.position),
        ),
      ),
      settlements: tiles.flatMap((entry) => entry.settlements),
      dry: (position) => !water.some((polygon) => insidePolygon(position, polygon)),
    };
  }

  function choose(candidates, positions, dry, spacing) {
    return candidates.find(
      (candidate) =>
        positions.every((position) => km(position, candidate) >= spacing) && dry(candidate),
    );
  }

  for (const point of points) {
    const { buildings, streets, dry } = near(point.coordinates, 1, false);
    const positions = occupied.get(point.routeId);
    const match =
      choose(buildings, positions, dry, 0.065) ??
      choose(buildings, positions, dry, 0.035) ??
      choose(streets, positions, dry, 0.065) ??
      choose(streets, positions, dry, 0.025);
    if (!match) throw new Error(`No distinct mapped location for ${point.id}`);
    point.coordinates = match;
    positions.push(point.coordinates);
  }

  const newLodgingStops = [];
  for (const stage of stages) {
    const { routeId, id: stageId } = stage;
    const positions = occupied.get(routeId);
    const beds = lodgingPositions.get(routeId);
    for (const { center, fraction, index } of sampleStage(stage.line)) {
      const area = near(center, 0.43);
      const { buildings, streets, dry } = area;
      const local = area.settlements
        .map(({ name, position }) => ({ name, distance: km(center, position) }))
        .filter(({ distance }) => distance <= 1.15)
        .sort((a, b) => a.distance - b.distance)[0]?.name;
      const location = local ?? `${stage.from} → ${stage.to}`;
      const routeKm = Number((stage.startKm + fraction * stage.km).toFixed(1));
      const key = `trail-${index + 1}`;
      const seed = stageId * 3 + index;
      if (buildings.length >= 4 && beds.every((point) => km(center, point) > 1.6)) {
        const position = choose(buildings, positions, dry, 0.075);
        if (position) {
          positions.push(position);
          beds.push(position);
          newLodgingStops.push({ routeId, stageId, key, town: location, position, seed });
        }
      }

      const firstPoint = points.length;
      for (const kind of serviceKinds(buildings.length, seed)) {
        const outdoor = kind === 'water' || kind === 'picnic' || kind === 'transit';
        const candidates = outdoor ? [...streets, ...buildings] : buildings;
        const coordinates =
          choose(candidates, positions, dry, 0.075) ?? choose(candidates, positions, dry, 0.04);
        if (!coordinates) continue;
        addPoint(kind, coordinates);
      }
      if (points.length === firstPoint) {
        // A quiet stretch can still have a demo rest spot on the dry walking trace.
        const coordinates = center.map((value) => Number(value.toFixed(6)));
        if (choose([coordinates], positions, dry, 0.075)) addPoint('picnic', coordinates);
      }

      function addPoint(kind, coordinates) {
        positions.push(coordinates);
        points.push({
          id: `${routeId}-${stageId}-${key}-${kind}`,
          routeId,
          stageId,
          kind,
          location,
          coordinates,
          routeKm,
        });
      }
    }
  }
  return { points, newLodgingStops };
}
