import { Camino, PlanningStop, plusDays } from './models';

// Short plans retain the existing minimum; slower plans also use intermediate lodging stops.
const dailyLimit = 60;

export function minimumDays(route: Camino): number {
  let days = 1;
  let km = 0;
  for (const stage of route.stages) {
    if (km && km + stage.km > dailyLimit) {
      days++;
      km = 0;
    }
    km += stage.km;
  }
  return days;
}

export function dayOptions(route: Camino): number[] {
  const first = minimumDays(route);
  return Array.from({ length: maximumDays(route) - first + 1 }, (_, index) => first + index);
}

function maximumDays(route: Camino): number {
  return Math.min(route.stages.length * 2, route.planningStops?.length ?? route.stages.length);
}

function stageStops(route: Camino): PlanningStop[] {
  let distance = 0;
  let ascent = 0;
  return route.stages.map((stage) => {
    distance += stage.km;
    ascent += stage.ascent;
    return {
      id: stage.id,
      stageId: stage.id,
      name: stage.to,
      position: stage.end,
      distance,
      ascent,
    };
  });
}

export function itinerary(route: Camino, days: number, date: string) {
  const count = Math.min(maximumDays(route), Math.max(minimumDays(route), Math.round(days)));
  const stops = count > route.stages.length ? route.planningStops! : stageStops(route);
  const length = stops.length;
  const target = route.km / count;
  const best = Array.from({ length: count + 1 }, () =>
    Array.from({ length: length + 1 }, () => ({ cost: Infinity, start: 0 })),
  );
  best[0][0].cost = 0;

  for (let day = 1; day <= count; day++) {
    for (let end = day; end <= length; end++) {
      for (let start = end - 1; start >= day - 1; start--) {
        const km = stops[end - 1].distance - (stops[start - 1]?.distance ?? 0);
        if (km > dailyLimit) break;
        const cost = best[day - 1][start].cost + (km - target) ** 2;
        if (cost < best[day][end].cost) best[day][end] = { cost, start };
      }
    }
  }

  const plan = [];
  let end = length;
  for (let day = count; day > 0; day--) {
    const { start } = best[day][end];
    const stop = stops[end - 1];
    const previous = stops[start - 1];
    plan.push({
      day,
      date: plusDays(date, day - 1),
      from: previous?.name ?? route.stages[0].from,
      to: stop.name,
      stopId: stop.id,
      stageId: stop.stageId,
      position: stop.position,
      distance: stop.distance,
      km: Math.round((stop.distance - (previous?.distance ?? 0)) * 10) / 10,
      ascent: Math.round(stop.ascent - (previous?.ascent ?? 0)),
    });
    end = start;
  }
  return plan.reverse();
}
