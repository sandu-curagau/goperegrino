import { Routes } from '@angular/router';

export const tabs = [
  {
    path: 'mapa',
    icon: 'map-outline',
    loadComponent: () => import('./pages/map-page').then((m) => m.MapPage),
  },
  {
    path: 'etapas',
    icon: 'footsteps-outline',
    loadComponent: () => import('./pages/stages-page').then((m) => m.StagesPage),
  },
  {
    path: 'reservas',
    icon: 'bed-outline',
    loadComponent: () => import('./pages/bookings-page').then((m) => m.BookingsPage),
  },
  {
    path: 'credencial',
    icon: 'ribbon-outline',
    loadComponent: () => import('./pages/passport-page').then((m) => m.PassportPage),
  },
  {
    path: 'perfil',
    icon: 'person-circle-outline',
    loadComponent: () => import('./pages/profile-page').then((m) => m.ProfilePage),
  },
] as const;

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'mapa' },
  ...tabs,
  { path: '**', redirectTo: 'mapa' },
];
