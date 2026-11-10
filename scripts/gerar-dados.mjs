import { mkdir, writeFile } from 'node:fs/promises';

const data = new URL('../public/data/', import.meta.url);
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
    id: 'tejo', name: 'Caminho do Tejo', destination: 'Fátima', color: '#236b72',
    stops: [
      ['Lisboa', -9.1327, 38.7101], ['Parque das Nações', -9.096, 38.767],
      ['Vila Franca de Xira', -8.989, 38.9537], ['Azambuja', -8.868, 39.0694],
      ['Santarém', -8.6879, 39.2362], ['Monsanto', -8.7084, 39.4621], fatima,
    ],
    km: [13, 28, 20, 32, 32, 25],
    ascent: [30, 65, 25, 105, 150, 440],
  },
  {
    id: 'centenario', name: 'Caminho do Centenário', destination: 'Fátima', color: '#a65a30',
    stops: [
      ['Vila Nova de Gaia', -8.6135, 41.1363], ['Espinho', -8.6414, 41.007],
      ['Ovar', -8.6248, 40.8584], ['Albergaria-a-Velha', -8.4792, 40.6945],
      ['Águeda', -8.4498, 40.5753], ['Mealhada', -8.4478, 40.3782],
      ['Coimbra', -8.426, 40.2089], ['Condeixa-a-Nova', -8.498, 40.1128],
      ['Pombal', -8.6281, 39.9158], fatima,
    ],
    km: [19, 19, 26, 18, 25, 22, 16, 35, 32],
    ascent: [170, 70, 210, 175, 225, 185, 225, 355, 465],
  },
  {
    id: 'central', name: 'Caminho Português Central', destination: 'Santiago', color: '#003058',
    stops: [
      porto, ['Vilarinho', -8.6655, 41.3313], ['Barcelos', -8.6152, 41.5319],
      ['Ponte de Lima', -8.5842, 41.7674], ['Rubiães', -8.623, 41.9013],
      ['Valença/Tui', -8.6449, 42.0467], ['O Porriño', -8.6188, 42.1612],
      redondela, ...galiza,
    ],
    km: [27, 27, 32, 18, 21, 19, 16, 20, 22, 24, 34],
    ascent: [220, 320, 290, 550, 220, 135, 320, 275, 215, 260, 500],
  },
  {
    id: 'costa', name: 'Caminho Português da Costa', destination: 'Santiago', color: '#317599',
    stops: [
      porto, ['Labruge', -8.729, 41.2759], ['Póvoa de Varzim', -8.7614, 41.3794],
      ['Esposende', -8.7821, 41.5317], ['Viana do Castelo', -8.8287, 41.6932],
      ['Caminha', -8.8387, 41.8758], ['Oia', -8.8759, 42.0007],
      ['Vigo', -8.7228, 42.2396], redondela, ...galiza,
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

const accommodationNames = [
  'Albergue da Seta Dourada', 'Casa da Mochila', 'Pátio dos Peregrinos',
  'Pousada da Estrada Velha', 'Hotel Passo Sereno', 'Casa da Oliveira Azul',
  'Albergue Entre Caminhos', 'Refúgio do Marco de Pedra', 'Quinta do Sol Poente',
  'Casa da Janela Amarela',
];
const facilities = ['wifi', 'laundry', 'pets', 'kitchen', 'breakfast'];
const accommodations = pathways.flatMap((route) => route.stages.flatMap((stage) =>
  accommodationNames.map((name, index) => {
    const id = `${route.id}-${stage.id}-${index + 1}`;
    const partner = index % 5 === 0;
    const angle = index * 2.4;
    const radius = 0.0025 + index * 0.00045;
    const [longitude, latitude] = stage.end;
    return {
      id, routeId: route.id, stageId: stage.id, name,
      location: {
        coordinates: {
          latitude: Number((latitude + radius * Math.sin(angle)).toFixed(5)),
          longitude: Number((longitude + radius * Math.cos(angle)).toFixed(5)),
        },
        address: `${stage.to} · Morada de demonstração`,
      },
      price: 18 + ((index * 11 + stage.id * 7) % 65),
      currency: 'EUR',
      review_score: Number((8 + ((index + 3) * stage.id % 18) / 10).toFixed(1)),
      review_count: 21 + (stage.id * 33 + index * 29) % 340,
      photos: [1, 2, 3].map((photo) => `https://picsum.photos/seed/${id}-${photo}/640/420`),
      facilities: facilities.filter((_, feature) => feature === 0 || (index + feature) % 3 !== 0),
      cancellation: 'Cancelamento gratuito até 48 horas antes da chegada.',
      partner, source: partner ? 'parceiro' : 'booking',
      ...(partner ? { phone: '000 000 000', whatsapp: '000 000 000' } : {}),
    };
  }),
));

const points = pathways.flatMap((route) => route.stages.flatMap((stage) =>
  ['stamp', 'water', 'cafe', 'pharmacy', 'church'].map((kind, index) => ({
    id: `${route.id}-${stage.id}-${kind}`, routeId: route.id, stageId: stage.id, kind,
    location: stage.to,
    coordinates: [stage.end[0] + (index - 2) * 0.001, stage.end[1] + index * 0.0005],
  })),
));

const warnings = [
  { id: '1', routeId: 'central', type: 'route', stageId: 4, title: 'Desvio sinalizado', text: 'Há obras num troço à saída de Ponte de Lima. Siga as indicações no local.' },
  { id: '2', routeId: 'tejo', type: 'route', stageId: 5, title: 'Reabasteça antes de sair', text: 'Há poucas fontes entre Santarém e Monsanto.' },
  { id: '3', routeId: 'costa', type: 'weather', stageId: 5, title: 'Vento no litoral', text: 'São esperadas rajadas nas zonas mais expostas da etapa.' },
  { id: '4', routeId: 'central', type: 'beds', stageId: 4, title: 'Poucas camas disponíveis', text: 'Os alojamentos da próxima etapa estão a ficar completos.' },
];

await mkdir(data, { recursive: true });
for (const [name, payload] of Object.entries({
  caminhos: pathways, alojamentos: accommodations, pontos: points, avisos: warnings,
})) {
  await writeFile(new URL(`${name}.json`, data), JSON.stringify(payload, null, name === 'caminhos' ? 2 : 0) + '\n');
}
