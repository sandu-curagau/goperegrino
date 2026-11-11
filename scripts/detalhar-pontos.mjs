const names = {
  cafe: [
    'Café Passo Leve',
    'Café da Oliveira',
    'Pastelaria Manhã Dourada',
    'Café Ponto de Encontro',
    'Café da Bica',
    'Café Sombra Fresca',
    'Pastelaria Pão Quente',
    'Café Bom Passo',
    'Café da Esquina',
    'Café Entre Caminhos',
    'Café Duas Chávenas',
    'Café da Praça',
  ],
  restaurant: [
    'Taberna do Peregrino',
    'Restaurante Mesa da Terra',
    'Casa dos Sabores',
    'Tasca da Dona Rosa',
    'Restaurante O Caminhante',
    'Cantinho da Horta',
    'Taberna Pão e Vinho',
    'Restaurante Panela de Ferro',
    'Casa da Açorda',
    'Restaurante Mesa Comprida',
    'Tasca Bom Garfo',
    'Restaurante A Eira',
  ],
  market: [
    'Mercado Bom Dia',
    'Mercearia Cesto Cheio',
    'Supermercado Fresco & Perto',
    'Mercado da Vila',
    'Mercearia Dona Amélia',
    'Supermercado Entre Caminhos',
    'Mercado Quinta Fresca',
    'Mercearia O Cabaz',
    'Mercado Pão e Fruta',
    'Supermercado Bom Vizinho',
    'Mercado da Esquina',
    'Mercearia Sabor da Terra',
  ],
  pharmacy: [
    'Farmácia Boa Esperança',
    'Farmácia da Oliveira',
    'Farmácia Bem-Estar',
    'Farmácia da Praça',
    'Farmácia Fonte Nova',
    'Farmácia do Caminho',
    'Farmácia Santa Clara',
    'Farmácia da Vila',
    'Farmácia Horizonte',
    'Farmácia Jardim',
    'Farmácia Central',
    'Farmácia Nova Vida',
  ],
  souvenir: [
    'Lembranças da Rota',
    'Ateliê da Seta',
    'Loja Caminho & Memória',
    'Artesanato Mãos da Terra',
    'Casa das Lembranças',
    'Loja Pé na Estrada',
    'Ateliê da Oliveira',
    'Oficina do Peregrino',
    'Loja Pedra e Linho',
    'Artesanato Raiz',
    'Loja A Concha',
    'Ateliê Fio da História',
  ],
  wellness: [
    'Spa Passo Sereno',
    'Espaço Corpo Leve',
    'Massagens Entre Caminhos',
    'Spa Água Mansa',
    'Centro de Massagens Novo Fôlego',
    'Espaço Pausa Natural',
    'Spa Fonte de Equilíbrio',
    'Centro de Massagens Passo a Passo',
    'Spa Sombra da Oliveira',
    'Espaço Respira',
    'Massagens Caminho Leve',
    'Spa Raiz e Água',
  ],
  stamp: [
    'Casa de Apoio ao Peregrino',
    'Posto do Peregrino',
    'Centro de Acolhimento da Rota',
    'Casa da Seta',
    'Espaço de Acolhimento Bom Caminho',
    'Posto Entre Caminhos',
    'Casa do Bom Passo',
    'Centro do Caminhante',
  ],
  water: [
    'Fonte da Oliveira',
    'Fonte da Bica',
    'Fonte da Água Clara',
    'Fonte do Adro',
    'Fonte da Portela',
    'Fonte da Ribeira',
    'Fonte do Souto',
    'Fonte do Bom Caminho',
  ],
  credentialShop: [
    'Casa da Credencial',
    'Balcão do Peregrino',
    'Loja Bom Caminho',
    'Centro de Apoio da Rota',
    'Casa da Seta Dourada',
    'Loja A Concha',
    'Espaço do Caminhante',
    'Casa Entre Etapas',
  ],
};
const qualifiers = [
  'da Fonte',
  'do Adro',
  'do Largo',
  'da Ponte',
  'do Rossio',
  'da Portela',
  'da Travessa',
  'do Jardim',
  'do Souto',
  'da Ribeira',
  'da Calçada',
  'do Pátio',
];
const chapelNames = [
  'Capela de Santa Clara',
  'Ermida da Boa Viagem',
  'Capela da Oliveira',
  'Ermida da Senhora da Luz',
  'Capela de São Bento',
  'Capela da Esperança',
  'Ermida dos Caminhantes',
  'Capela do Bom Passo',
];
const bridgeNames = [
  'Ponte da Ribeira',
  'Ponte Velha da Oliveira',
  'Ponte dos Caminhantes',
  'Ponte do Arco',
  'Ponte de Pedra do Souto',
  'Ponte da Portela',
  'Ponte do Vale',
  'Ponte da Água Clara',
];
const churches = [
  'Igreja de Santa Clara',
  'Igreja de São Tiago',
  'Igreja da Boa Esperança',
  'Igreja de São Bento',
  'Igreja da Senhora da Luz',
  'Igreja de Santa Maria',
  'Igreja do Bom Caminho',
  'Igreja do Salvador',
];

function hash(text) {
  let value = 2166136261;
  for (const letter of text) value = Math.imul(value ^ letter.charCodeAt(0), 16777619);
  return value >>> 0;
}

function placeName(point, seed) {
  const index = seed % qualifiers.length;
  const qualifier = qualifiers[index];
  if (point.kind === 'toilet') return undefined;
  if (point.kind === 'postOffice') return 'Estação de Correios ' + qualifier;
  if (point.kind === 'transit') return (seed % 2 ? 'Paragem ' : 'Terminal ') + qualifier;
  if (point.kind === 'picnic') return 'Parque de Merendas ' + qualifier;
  const options =
    point.kind === 'monument'
      ? point.heritage === 'bridge'
        ? bridgeNames
        : chapelNames
      : point.kind === 'church'
        ? churches
        : names[point.kind];
  return options[seed % options.length];
}

const photos = {
  cafe: ['places/cafe.jpg', 'places/cafe-sunlight.jpg'],
  restaurant: ['places/restaurant.jpg'],
  market: ['places/market.jpg'],
  wellness: ['places/massage.jpg', 'places/sauna.jpg'],
  church: ['places/chapel.jpg'],
};
const hours = {
  cafe: ['06:30', '19:00', 'daily'],
  restaurant: ['12:00', '22:00', 'daily'],
  market: ['08:00', '20:00', 'daily'],
  pharmacy: ['09:00', '19:00', 'monSat'],
  souvenir: ['10:00', '19:00', 'monSat'],
  postOffice: ['09:00', '17:30', 'weekdays'],
  credentialShop: ['09:00', '18:00', 'monSat'],
  wellness: ['10:00', '20:00', 'monSat'],
  stamp: ['08:00', '19:00', 'daily'],
};

export function detailPlaces(points) {
  const used = new Set();
  for (const point of points) {
    const seed = hash(point.id);
    if (point.kind === 'monument') point.heritage = seed % 3 === 0 ? 'bridge' : 'chapel';
    const base = placeName(point, seed);
    if (base) {
      let name = base;
      let variant = 0;
      while (used.has(point.routeId + ':' + point.location + ':' + name)) {
        name = base + ' ' + qualifiers[(seed + variant++) % qualifiers.length];
        if (variant > qualifiers.length)
          name += ' · ' + point.location + ' ' + (point.routeKm ?? point.stageId);
      }
      point.name = name;
      used.add(point.routeId + ':' + point.location + ':' + name);
    }
    const gallery =
      point.kind === 'monument' ? ['places/' + point.heritage + '.jpg'] : photos[point.kind];
    if (gallery) point.photos = seed % 2 ? [...gallery].reverse() : [...gallery];
    if (hours[point.kind]) {
      const [open, close, days] = hours[point.kind];
      point.hours = { open, close, days };
    }
    if (point.kind === 'restaurant') point.priceFrom = 9 + (seed % 8);
    if (point.kind === 'cafe') point.priceFrom = 2.5 + (seed % 6) / 2;
    if (point.kind === 'wellness') point.priceFrom = 25 + (seed % 5) * 5;
    if (point.kind === 'monument' || point.kind === 'church')
      point.visitMinutes = 15 + (seed % 4) * 5;
  }
  return points;
}
