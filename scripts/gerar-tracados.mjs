import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { setTimeout as sleep } from 'node:timers/promises';

const data = new URL('../public/data/', import.meta.url);
const output = new URL('tracados/', data);
const routes = JSON.parse(await readFile(new URL('caminhos.json', data), 'utf8'));
const cache = new Map();

await mkdir(output, { recursive: true });
for (const route of routes) {
  const features = [];
  for (const stage of route.stages) {
    const key = [stage.start, stage.end].map((point) => point.join(',')).join('|');
    if (!cache.has(key)) {
      const params = new URLSearchParams({
        lonlats: key, profile: 'hiking-mountain', alternativeidx: '0', format: 'geojson',
      });
      try {
        const response = await fetch('https://brouter.de/brouter?' + params, {
          signal: AbortSignal.timeout(12000),
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const line = (await response.json()).features.find((feature) => feature.geometry.type === 'LineString');
        if (!line?.geometry.coordinates.length) throw new Error('Traçado vazio');
        cache.set(key, {
          coordinates: line.geometry.coordinates.map(([lon, lat]) => [lon, lat]),
          fallback: false,
        });
      } catch (error) {
        console.warn(`${route.id} ${stage.id}: ${error.message}. A usar linha reta.`);
        cache.set(key, { coordinates: [stage.start, stage.end], fallback: true });
      }
      await sleep(1000);
    }

    const { coordinates, fallback } = cache.get(key);
    features.push({
      type: 'Feature', properties: { stageId: stage.id, fallback },
      geometry: { type: 'LineString', coordinates },
    });
    console.log(`${route.id} ${stage.id}/${route.stages.length}: ${coordinates.length} pontos`);
  }
  await writeFile(new URL(`${route.id}.geojson`, output),
    JSON.stringify({ type: 'FeatureCollection', features }) + '\n');
}
