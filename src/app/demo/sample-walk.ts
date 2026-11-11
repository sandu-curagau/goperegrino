import type { Camino, WalkRecord } from './models';

export const sampleId = 'sample-coastal-walk';
export const sampleDate = '2026-09-07';
export const sampleEntries = [
  [1, 'Vila Chã', 'vila-cha', 'journalSampleVilaCha'],
  [2, 'Esposende', 'esposende', 'journalSampleEsposende'],
  [3, 'Viana do Castelo', 'viana', 'journalSampleViana'],
  [4, 'Caminha', '', 'journalSamplePause'],
  [8, 'Pontevedra', '', 'journalSampleFriends'],
  [11, 'Santiago de Compostela', 'santiago', 'journalSampleSantiago'],
] as const;

export function sampleWalk(routes: Camino[]): WalkRecord | undefined {
  const coast = routes.find((route) => route.id === 'costa');
  return coast
    ? {
        id: sampleId,
        routeId: coast.id,
        date: sampleDate,
        days: coast.stages.length,
        distance: coast.km,
      }
    : undefined;
}
