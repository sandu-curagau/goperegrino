import { Camino, plusDays } from './models';

// Use existing stage ends so every proposed overnight stop has accommodation in the demo.
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
  return Array.from({ length: route.stages.length - first + 1 }, (_, index) => first + index);
}

export function itinerary(route: Camino, days: number, date: string) {
  const count = Math.min(route.stages.length, Math.max(minimumDays(route), Math.round(days)));
  const length = route.stages.length;
  const target = route.km / count;
  const best = Array.from({ length: count + 1 }, () =>
    Array.from({ length: length + 1 }, () => ({ cost: Infinity, start: 0 })),
  );
  best[0][0].cost = 0;

  for (let day = 1; day <= count; day++) {
    for (let end = day; end <= length; end++) {
      let km = 0;
      for (let start = end - 1; start >= day - 1; start--) {
        km += route.stages[start].km;
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
    const group = route.stages.slice(start, end);
    plan.push({
      day,
      date: plusDays(date, day - 1),
      from: group[0].from,
      to: group[group.length - 1].to,
      km: group.reduce((sum, stage) => sum + stage.km, 0),
      ascent: group.reduce((sum, stage) => sum + stage.ascent, 0),
    });
    end = start;
  }
  return plan.reverse();
}
