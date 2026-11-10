import { Routes } from '@angular/router';

export const tabs = [
  { path: 'mapa', title: 'Mapa', icon: 'map-outline' },
  { path: 'etapas', title: 'Etapas', icon: 'footsteps-outline' },
  { path: 'reservas', title: 'Reservas', icon: 'bed-outline' },
  { path: 'credencial', title: 'Credencial', icon: 'ribbon-outline' },
  { path: 'perfil', title: 'Perfil', icon: 'person-circle-outline' },
] as const;

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'mapa' },
  ...tabs.map(({ path, title }) => ({
    path,
    title: `GoPeregrino · ${title}`,
    data: { title },
    loadComponent:
      path === 'mapa'
        ? () => import('./pages/map-page').then((module) => module.MapPage)
        : path === 'reservas'
          ? () => import('./pages/bookings-page').then((module) => module.BookingsPage)
          : () => import('./tab-page').then((module) => module.TabPage),
  })),
  { path: '**', redirectTo: 'mapa' },
];
