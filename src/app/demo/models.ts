export type Point = [number, number];

export interface Stage {
  id: number;
  from: string;
  to: string;
  start: Point;
  end: Point;
  km: number;
  ascent: number;
  description: string;
  contacts: { service: string; number: string }[];
}

export interface Camino {
  id: string;
  name: string;
  destination: 'Fátima' | 'Santiago';
  color: string;
  km: number;
  stages: Stage[];
}

export interface Lodging {
  id: string;
  routeId: string;
  stageId: number;
  name: string;
  location: { coordinates: { latitude: number; longitude: number }; address: string };
  price: number;
  currency: string;
  review_score: number;
  review_count: number;
  photos: string[];
  facilities: string[];
  cancellation: string;
  partner: boolean;
  source: 'parceiro' | 'booking';
  phone?: string;
  whatsapp?: string;
}

export interface Waypoint {
  id: string;
  routeId: string;
  stageId: number;
  kind: 'stamp' | 'water' | 'cafe' | 'pharmacy' | 'church';
  location: string;
  coordinates: Point;
}

export interface Notice {
  id: string;
  routeId: string;
  stageId: number;
  type: 'route' | 'weather' | 'beds';
  title: string;
  text: string;
}

export interface Reservation {
  code: string;
  lodgingId: string;
  arrival: string;
  departure: string;
  guests: number;
  name: string;
  status: 'confirmed' | 'cancelled';
}

export interface Stamp {
  id: string;
  routeId: string;
  name: string;
  date: string;
}

export interface TrailLine {
  type: 'FeatureCollection';
  features: {
    type: 'Feature';
    properties: { stageId: number; fallback: boolean };
    geometry: { type: 'LineString'; coordinates: Point[] };
  }[];
}

export function dateInput(date = new Date()): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

export function plusDays(value: string, days: number): string {
  const date = new Date(value + 'T12:00:00');
  date.setDate(date.getDate() + days);
  return dateInput(date);
}

export function lodgingPoint(lodging: Lodging): Point {
  const { longitude, latitude } = lodging.location.coordinates;
  return [longitude, latitude];
}

export function kmBetween(a: Point, b: Point): number {
  const degrees = Math.PI / 180;
  const haversine =
    Math.sin(((b[1] - a[1]) * degrees) / 2) ** 2 +
    Math.cos(a[1] * degrees) *
      Math.cos(b[1] * degrees) *
      Math.sin(((b[0] - a[0]) * degrees) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(haversine));
}
