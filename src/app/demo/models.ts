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
  planningStops?: PlanningStop[];
}

export interface PlanningStop {
  id: number;
  stageId: number;
  name: string;
  position: Point;
  distance: number;
  ascent: number;
}

export interface Lodging {
  id: string;
  routeId: string;
  stageId: number;
  intermediate?: true;
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
  roomType?: RoomType;
  rooms?: number;
  total?: number;
}

export type RoomType = 'singleRoom' | 'doubleRoom' | 'twinRoom' | 'familyRoom';

export interface PaymentCard {
  id: string;
  brand: string;
  last4: string;
  expiry: string;
  nickname: string;
}

export type AvatarColor = 'ocean' | 'forest' | 'sunset' | 'violet';

export interface PilgrimProfile {
  name: string;
  bio: string;
  photo: string;
  color: AvatarColor;
  featuredAchievements: string[];
}

export interface Stamp {
  id: string;
  routeId: string;
  walkId?: string;
  pointId?: string;
  name: string;
  date: string;
}

export interface WalkRecord {
  id: string;
  routeId: string;
  date: string;
  days: number;
  distance: number;
}

export interface JournalEntry {
  id?: string;
  walkId: string;
  date: string;
  createdAt?: string;
  location?: string;
  position?: Point;
  note: string;
  photos: string[];
}

export interface TrailComment {
  id: string;
  routeId: string;
  position: Point;
  location: string;
  message: string;
  createdAt: string;
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

export function stayPrice(
  arrival: string,
  departure: string,
  guests: number,
  nightly: number,
  capacity = 2,
) {
  const nights = Math.max(1, (Date.parse(departure) - Date.parse(arrival)) / 86400000 || 1);
  const rooms = Math.ceil(Math.max(1, guests) / capacity);
  return { nights, rooms, total: nights * rooms * nightly };
}

export function distanceToLodging(position: Point | undefined, lodging: Lodging): number | null {
  return position ? kmBetween(position, lodgingPoint(lodging)) : null;
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
