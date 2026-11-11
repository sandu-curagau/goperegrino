import type { Camino, Lodging, Reservation } from './models';
import { kmBetween, lodgingPoint } from './models';
import type { itinerary } from './itinerary';

export type WalkingPlan = ReturnType<typeof itinerary>;
export interface BookingConflict {
  booking: Reservation;
  place: Lodging;
  stop: WalkingPlan[number] | undefined;
}

export function walkReservations(
  route: Camino,
  plan: WalkingPlan,
  bookings: Reservation[],
  lodgings: Lodging[],
  walkId: string,
) {
  return bookings.flatMap((booking) => {
    if (booking.status !== 'confirmed') return [];
    const place = lodgings.find((item) => item.id === booking.lodgingId);
    if (!place || place.routeId !== route.id) return [];
    const belongs = booking.walkId
      ? booking.walkId === walkId
      : !!plan.length && booking.arrival <= plan.at(-1)!.date && booking.departure > plan[0].date;
    return belongs ? [{ booking, place }] : [];
  });
}

export function bookingConflicts(
  route: Camino,
  plan: WalkingPlan,
  bookings: Reservation[],
  lodgings: Lodging[],
  walkId: string,
  previousPlan = plan,
): BookingConflict[] {
  return walkReservations(route, previousPlan, bookings, lodgings, walkId).flatMap(
    ({ booking, place }) => {
      const nearby = plan
        .map((stop) => ({ stop, distance: kmBetween(stop.position, lodgingPoint(place)) }))
        .filter((entry) => entry.distance <= 5)
        .sort((a, b) => a.distance - b.distance);
      if (nearby.some(({ stop }) => booking.arrival <= stop.date && booking.departure > stop.date))
        return [];
      return [{ booking, place, stop: nearby[0]?.stop }];
    },
  );
}
