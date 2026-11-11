export function walkingTime(km: number) {
  const minutes = Math.max(0, Math.round((km / 4.5) * 60));
  return { hours: Math.floor(minutes / 60), minutes: minutes % 60 };
}
