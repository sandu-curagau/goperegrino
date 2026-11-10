import { Camino, plusDays } from './models';

export function itinerary(route: Camino, days: number, date: string) {
  const count = Math.min(route.stages.length, Math.max(1, Math.round(days)));
  return Array.from({ length: count }, (_, index) => {
    const group = route.stages.slice(
      Math.floor((index * route.stages.length) / count),
      Math.floor(((index + 1) * route.stages.length) / count),
    );
    return {
      day: index + 1,
      date: plusDays(date, index),
      from: group[0].from,
      to: group[group.length - 1].to,
      km: group.reduce((sum, stage) => sum + stage.km, 0),
      ascent: group.reduce((sum, stage) => sum + stage.ascent, 0),
    };
  });
}
