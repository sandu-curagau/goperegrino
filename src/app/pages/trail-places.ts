import {
  bagHandleOutline,
  bookOutline,
  busOutline,
  cafeOutline,
  cartOutline,
  fitnessOutline,
  informationCircleOutline,
  locationOutline,
  mailOutline,
  restaurantOutline,
  ribbonOutline,
  sparklesOutline,
  trailSignOutline,
  waterOutline,
} from 'ionicons/icons';
import type { Locale, Message } from '../demo/locale';
import type { TrailPlaceKind, Waypoint } from '../demo/models';

export const trailPlaces = {
  stamp: { label: 'stampSpots', icon: ribbonOutline, color: '#604486' },
  credentialShop: { label: 'credentialShop', icon: bookOutline, color: '#174e75' },
  postOffice: { label: 'postOffice', icon: mailOutline, color: '#9b343c' },
  monument: { label: 'monument', icon: trailSignOutline, color: '#78521e' },
  restaurant: { label: 'restaurant', icon: restaurantOutline, color: '#9a4127' },
  wellness: { label: 'wellness', icon: sparklesOutline, color: '#386e61' },
  market: { label: 'market', icon: cartOutline, color: '#2c6550' },
  souvenir: { label: 'souvenir', icon: bagHandleOutline, color: '#853c64' },
  transit: { label: 'transit', icon: busOutline, color: '#205e70' },
  pharmacy: { label: 'pharmacy', icon: fitnessOutline, color: '#a23b4a' },
  water: { label: 'waterFountain', icon: waterOutline, color: '#006a93' },
  cafe: { label: 'cafe', icon: cafeOutline, color: '#745136' },
  toilet: { label: 'toilet', icon: informationCircleOutline, color: '#475d71' },
  picnic: { label: 'picnic', icon: locationOutline, color: '#4a6538' },
} as const satisfies Record<TrailPlaceKind, { label: Message; icon: string; color: string }>;

export const trailPlaceKinds = Object.keys(trailPlaces) as TrailPlaceKind[];

export function mapPlaceKind(point: Waypoint): TrailPlaceKind {
  return point.kind === 'church' ? 'stamp' : point.kind;
}

export function placeLocation(point: Waypoint, locale: Locale): string {
  if (point.routeKm === undefined) return point.location;
  const kilometre = locale.t('placeRouteKm', { km: locale.number(point.routeKm, 1) });
  return point.location + ' · ' + kilometre;
}
