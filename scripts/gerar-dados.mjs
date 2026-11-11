import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { locatePlaces } from './localizar-pontos.mjs';

const data = new URL('../public/data/', import.meta.url);
const lodgingLocations = JSON.parse(
  await readFile(new URL('./alojamentos-locais.json', import.meta.url), 'utf8'),
);
const intermediateLodgings = JSON.parse(
  await readFile(new URL('./alojamentos-intermedios.json', import.meta.url), 'utf8'),
);
const porto = ['Porto', -8.611, 41.1428];
const fatima = ['Fátima', -8.6732, 39.6313];
const redondela = ['Redondela', -8.6093, 42.2837];
const galiza = [
  ['Pontevedra', -8.6441, 42.431],
  ['Caldas de Reis', -8.6424, 42.6049],
  ['Padrón', -8.6605, 42.7388],
  ['Santiago', -8.5447, 42.8806],
];
const routes = [
  {
    id: 'tejo',
    name: 'Caminho do Tejo',
    destination: 'Fátima',
    color: '#236b72',
    stops: [
      ['Lisboa', -9.1327, 38.7101],
      ['Parque das Nações', -9.096, 38.767],
      ['Vila Franca de Xira', -8.989, 38.9537],
      ['Azambuja', -8.868, 39.0694],
      ['Santarém', -8.6879, 39.2362],
      ['Monsanto', -8.7084, 39.4621],
      fatima,
    ],
    km: [13, 28, 20, 32, 32, 25],
    ascent: [30, 65, 25, 105, 150, 440],
  },
  {
    id: 'centenario',
    name: 'Caminho do Centenário',
    destination: 'Fátima',
    color: '#a65a30',
    stops: [
      ['Vila Nova de Gaia', -8.6135, 41.1363],
      ['Espinho', -8.6414, 41.007],
      ['Ovar', -8.6248, 40.8584],
      ['Albergaria-a-Velha', -8.4792, 40.6945],
      ['Águeda', -8.4498, 40.5753],
      ['Mealhada', -8.4478, 40.3782],
      ['Coimbra', -8.426, 40.2089],
      ['Condeixa-a-Nova', -8.498, 40.1128],
      ['Pombal', -8.6281, 39.9158],
      fatima,
    ],
    km: [19, 19, 26, 18, 25, 22, 16, 35, 32],
    ascent: [170, 70, 210, 175, 225, 185, 225, 355, 465],
  },
  {
    id: 'central',
    name: 'Caminho Português Central',
    destination: 'Santiago',
    color: '#003058',
    stops: [
      porto,
      ['Vilarinho', -8.6655, 41.3313],
      ['Barcelos', -8.6152, 41.5319],
      ['Ponte de Lima', -8.5842, 41.7674],
      ['Rubiães', -8.623, 41.9013],
      ['Valença/Tui', -8.6449, 42.0467],
      ['O Porriño', -8.6188, 42.1612],
      redondela,
      ...galiza,
    ],
    km: [27, 27, 32, 18, 21, 19, 16, 20, 22, 24, 34],
    ascent: [220, 320, 290, 550, 220, 135, 320, 275, 215, 260, 500],
  },
  {
    id: 'costa',
    name: 'Caminho Português da Costa',
    destination: 'Santiago',
    color: '#317599',
    stops: [
      porto,
      ['Labruge', -8.729, 41.2759],
      ['Póvoa de Varzim', -8.7614, 41.3794],
      ['Esposende', -8.7821, 41.5317],
      ['Viana do Castelo', -8.8287, 41.6932],
      ['Caminha', -8.8387, 41.8758],
      ['Oia', -8.8759, 42.0007],
      ['Vigo', -8.7228, 42.2396],
      redondela,
      ...galiza,
    ],
    km: [24, 15, 22, 27, 28, 22, 39, 16, 20, 22, 23, 22],
    ascent: [135, 55, 105, 190, 255, 225, 450, 210, 275, 215, 255, 485],
  },
];

const pathways = routes.map(({ stops, km, ascent, ...route }) => ({
  ...route,
  km: km.reduce((sum, distance) => sum + distance, 0),
  stages: km.map((distance, index) => ({
    id: index + 1,
    from: stops[index][0],
    to: stops[index + 1][0],
    start: stops[index].slice(1),
    end: stops[index + 1].slice(1),
    km: distance,
    ascent: ascent[index],
    description: 'Percurso pedestre de demonstração entre {from} e {to}.',
    contacts: [
      { service: 'Polícia local', number: '000 000 000' },
      { service: 'Centro de saúde', number: '000 000 000' },
    ],
  })),
}));

function earthDistance(a, b) {
  const radians = Math.PI / 180;
  const h =
    Math.sin(((b[1] - a[1]) * radians) / 2) ** 2 +
    Math.cos(a[1] * radians) *
      Math.cos(b[1] * radians) *
      Math.sin(((b[0] - a[0]) * radians) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
}

function projectStop(point, line) {
  let nearest = { offset: Infinity, distance: 0, position: line[0] };
  let travelled = 0;
  const scale = Math.cos((point[1] * Math.PI) / 180);
  for (let index = 1; index < line.length; index++) {
    const a = line[index - 1],
      b = line[index];
    const dx = (b[0] - a[0]) * scale,
      dy = b[1] - a[1];
    const fraction = Math.max(
      0,
      Math.min(
        1,
        ((point[0] - a[0]) * scale * dx + (point[1] - a[1]) * dy) / (dx * dx + dy * dy) || 0,
      ),
    );
    const position = [a[0] + (b[0] - a[0]) * fraction, a[1] + dy * fraction];
    const length = earthDistance(a, b);
    const offset = earthDistance(point, position);
    if (offset < nearest.offset)
      nearest = { offset, distance: travelled + length * fraction, position };
    travelled += length;
  }
  return { ...nearest, fraction: travelled ? nearest.distance / travelled : 0 };
}

const trailStages = [];
// Slower plans stop at existing lodging locations, projected onto the walking route.
for (const route of pathways) {
  let geometry;
  try {
    geometry = JSON.parse(await readFile(new URL(`tracados/${route.id}.geojson`, data), 'utf8'));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  let distance = 0,
    ascent = 0;
  route.planningStops = [];
  for (const stage of route.stages) {
    const line = geometry?.features.find((feature) => feature.properties.stageId === stage.id)
      ?.geometry.coordinates ?? [stage.start, stage.end];
    trailStages.push({ ...stage, line, routeId: route.id, startKm: distance });
    const candidates = (intermediateLodgings[route.id]?.[stage.id] ?? [])
      .filter((stop) => !stop.town.includes('–'))
      .map((stop, index) => ({ ...stop, index, ...projectStop(stop.positions[0], line) }))
      .filter(
        (stop) =>
          stop.offset < 3 && stop.fraction * stage.km >= 2 && (1 - stop.fraction) * stage.km >= 2,
      )
      .sort((a, b) => a.fraction - b.fraction);
    let previous = 0;
    for (const stop of candidates) {
      if (stop.fraction * stage.km - previous < 2) continue;
      previous = stop.fraction * stage.km;
      route.planningStops.push({
        id: -(stage.id * 100 + stop.index + 1),
        stageId: stage.id,
        name: stop.town,
        position: stop.position,
        distance: distance + stop.fraction * stage.km,
        ascent: ascent + stop.fraction * stage.ascent,
      });
    }
    distance += stage.km;
    ascent += stage.ascent;
    route.planningStops.push({
      id: stage.id,
      stageId: stage.id,
      name: stage.to,
      position: stage.end,
      distance,
      ascent,
    });
  }
}

const accommodationNames = [
  'Albergue da Seta Dourada',
  'Casa da Mochila',
  'Pátio dos Peregrinos',
  'Pousada da Estrada Velha',
  'Hotel Passo Sereno',
  'Casa da Oliveira Azul',
  'Albergue Entre Caminhos',
  'Refúgio do Marco de Pedra',
  'Quinta do Sol Poente',
  'Casa da Janela Amarela',
];
const intermediateNames = [
  'Casa do Caminhante',
  'Pensão do Marco',
  'Quinta do Passo',
  'Hospedaria do Ribeiro',
  'Casa das Botas',
  'Pouso da Fonte',
  'Refúgio do Caminho',
  'Casa da Ponte',
];
const facilities = ['wifi', 'laundry', 'pets', 'kitchen', 'breakfast'];
function accommodation({
  id,
  routeId,
  stageId,
  town,
  position,
  seed,
  partner,
  intermediate,
  name,
}) {
  const [longitude, latitude] = position;
  return {
    id,
    routeId,
    stageId,
    ...(intermediate ? { intermediate: true } : {}),
    name,
    location: {
      coordinates: { latitude, longitude },
      address: `${town} · Morada de demonstração`,
    },
    price: 18 + ((seed * 11 + stageId * 7) % 65),
    currency: 'EUR',
    review_score: Number((8 + (((seed + 3) * stageId) % 18) / 10).toFixed(1)),
    review_count: 21 + ((stageId * 33 + seed * 29) % 340),
    photos: [1, 2, 3].map((photo) => `https://picsum.photos/seed/${id}-${photo}/640/420`),
    facilities: facilities.filter((_, feature) => feature === 0 || (seed + feature) % 3 !== 0),
    cancellation: 'Cancelamento gratuito até 48 horas antes da chegada.',
    partner,
    source: partner ? 'parceiro' : 'booking',
    ...(partner ? { phone: '000 000 000', whatsapp: '000 000 000' } : {}),
  };
}
const accommodations = pathways.flatMap((route) =>
  [
    ...route.stages.map((stage) => ({
      id: stage.id,
      town: stage.to,
      positions: lodgingLocations[stage.end.join(',')] ?? [],
    })),
    {
      id: 0,
      town: route.stages[0].from,
      positions: lodgingLocations[route.stages[0].start.join(',')] ?? [],
    },
    // Intermediate points are named places and dry building footprints from the offline map.
    ...route.stages.flatMap((stage) =>
      (intermediateLodgings[route.id]?.[stage.id] ?? []).map(({ key, town, positions }, index) => ({
        id: stage.id,
        key,
        town,
        positions,
        group: index + 1,
      })),
    ),
  ].flatMap((stop) =>
    stop.positions.map((position, index) => {
      const group = stop.group ?? 0;
      const prefix = group ? `${route.id}-${stop.id}-via-${stop.key}` : `${route.id}-${stop.id}`;
      const id = `${prefix}-${index + 1}`;
      const seed = index + group * 3;
      const partner = group ? index === 1 && group % 3 === 0 : index % 5 === 0;
      return accommodation({
        id,
        routeId: route.id,
        stageId: stop.id,
        town: stop.town,
        position,
        seed,
        partner,
        intermediate: !!group,
        name: group
          ? intermediateNames[(seed + stop.id) % intermediateNames.length]
          : accommodationNames[index],
      });
    }),
  ),
);

const nearbyKinds = [
  'water',
  'cafe',
  'market',
  'toilet',
  'pharmacy',
  'picnic',
  'monument',
  'restaurant',
  'souvenir',
  'transit',
];
const serviceTowns = new Set([
  'Parque das Nações',
  'Vila Franca de Xira',
  'Santarém',
  'Fátima',
  'Espinho',
  'Águeda',
  'Coimbra',
  'Pombal',
  'Barcelos',
  'Ponte de Lima',
  'Valença/Tui',
  'O Porriño',
  'Pontevedra',
  'Padrón',
  'Póvoa de Varzim',
  'Esposende',
  'Viana do Castelo',
  'Caminha',
  'Vigo',
  'Santiago',
]);
const { points, newLodgingStops } = await locatePlaces(
  new URL('offline/trilhos.bin', data),
  pathways.flatMap((route) => [
    ...route.stages.flatMap((stage) =>
      [
        'stamp',
        'water',
        'cafe',
        'pharmacy',
        'church',
        'market',
        'toilet',
        'picnic',
        'monument',
        'restaurant',
        'souvenir',
        'transit',
        ...(serviceTowns.has(stage.to) ? ['postOffice', 'credentialShop', 'wellness'] : []),
      ].map((kind, index) => ({
        id: `${route.id}-${stage.id}-${kind}`,
        routeId: route.id,
        stageId: stage.id,
        kind,
        location: stage.to,
        coordinates:
          lodgingLocations[stage.end.join(',')]?.[
            index % (lodgingLocations[stage.end.join(',')]?.length || 1)
          ] ?? stage.end,
      })),
    ),
    ...['stamp', 'church', ...nearbyKinds, 'postOffice', 'credentialShop', 'wellness'].map(
      (kind, index) => ({
        id: `${route.id}-0-${kind}`,
        routeId: route.id,
        stageId: 0,
        kind,
        location: route.stages[0].from,
        coordinates:
          lodgingLocations[route.stages[0].start.join(',')]?.[
            index % (lodgingLocations[route.stages[0].start.join(',')]?.length || 1)
          ] ?? route.stages[0].start,
      }),
    ),
    ...route.stages.flatMap((stage) =>
      (intermediateLodgings[route.id]?.[stage.id] ?? []).flatMap(
        ({ key, town, positions }, index) =>
          (index % 3 === 0
            ? ['water', 'cafe', 'toilet', 'restaurant', 'stamp']
            : index % 3 === 1
              ? ['water', 'market', 'picnic', 'transit']
              : ['cafe', 'water']
          ).map((kind, slot) => ({
            id: `${route.id}-${stage.id}-${key}-${kind}`,
            routeId: route.id,
            stageId: stage.id,
            kind,
            location: town,
            coordinates: positions[slot % positions.length],
          })),
      ),
    ),
  ]),
  accommodations,
  trailStages,
);
for (const stop of newLodgingStops) {
  accommodations.push(
    accommodation({
      ...stop,
      id: `${stop.routeId}-${stop.stageId}-${stop.key}-stay`,
      intermediate: true,
      name: intermediateNames[stop.seed % intermediateNames.length],
      partner: stop.seed % 8 === 0,
    }),
  );
}

const warnings = [
  {
    id: '1',
    routeId: 'central',
    type: 'route',
    stageId: 4,
    title: 'Desvio sinalizado',
    text: 'Há obras num troço à saída de Ponte de Lima. Siga as indicações no local.',
  },
  {
    id: '2',
    routeId: 'tejo',
    type: 'route',
    stageId: 5,
    title: 'Reabasteça antes de sair',
    text: 'Há poucas fontes entre Santarém e Monsanto.',
  },
  {
    id: '3',
    routeId: 'costa',
    type: 'weather',
    stageId: 5,
    title: 'Vento no litoral',
    text: 'São esperadas rajadas nas zonas mais expostas da etapa.',
  },
  {
    id: '4',
    routeId: 'central',
    type: 'beds',
    stageId: 4,
    title: 'Poucas camas disponíveis',
    text: 'Os alojamentos da próxima etapa estão a ficar completos.',
  },
  ...[
    [
      '5',
      'costa',
      'route',
      2,
      'Passadiço em manutenção',
      'Use o desvio pedonal junto à praia de Labruge.',
    ],
    [
      '6',
      'costa',
      'route',
      4,
      'Piso irregular',
      'O troço ribeirinho à saída de Esposende tem piso irregular.',
    ],
    [
      '7',
      'tejo',
      'route',
      2,
      'Passagem estreita',
      'Junto ao rio, o percurso partilha uma passagem estreita com ciclistas.',
    ],
    [
      '8',
      'tejo',
      'weather',
      4,
      'Calor na lezíria',
      'Há pouca sombra na saída de Azambuja. Leve água adicional.',
    ],
    [
      '9',
      'centenario',
      'route',
      5,
      'Travessia com obras',
      'O atravessamento junto a Águeda tem um desvio pedonal sinalizado.',
    ],
    [
      '10',
      'centenario',
      'beds',
      6,
      'Poucas camas em Coimbra',
      'A disponibilidade à chegada a Coimbra é reduzida.',
    ],
    [
      '11',
      'central',
      'route',
      5,
      'Subida escorregadia',
      'O empedrado à saída de Rubiães pode estar escorregadio.',
    ],
    [
      '12',
      'central',
      'weather',
      9,
      'Chuva em Pontevedra',
      'Há previsão de chuva durante a manhã. Prepare o impermeável.',
    ],
  ].map(([id, routeId, type, stageId, title, text]) => ({
    id,
    routeId,
    type,
    stageId,
    title,
    text,
  })),
];

await mkdir(data, { recursive: true });
for (const [name, payload] of Object.entries({
  caminhos: pathways,
  alojamentos: accommodations,
  pontos: points,
  avisos: warnings,
})) {
  await writeFile(
    new URL(`${name}.json`, data),
    JSON.stringify(payload, null, name === 'caminhos' ? 2 : 0) + '\n',
  );
}
