import { inject } from '@angular/core';
import { Router, Routes, type CanActivateFn } from '@angular/router';
import { DemoStore } from './demo/demo-store';

export const walkOnlyTabs = new Set(['etapas', 'mapa']);
const requireOpenWalk: CanActivateFn = () =>
  !inject(DemoStore).walkClosed() || inject(Router).createUrlTree(['/caminho']);

export const tabs = [
  {
    path: 'etapas',
    icon: 'footsteps-outline',
    loadComponent: () => import('./pages/stages-page').then((m) => m.StagesPage),
  },
  {
    path: 'caminho',
    icon: 'ribbon-outline',
    loadComponent: () => import('./pages/current-walk-page').then((m) => m.CurrentWalkPage),
  },
  {
    path: 'mapa',
    icon: 'map-outline',
    loadComponent: () => import('./pages/map-page').then((m) => m.MapPage),
  },
  {
    path: 'reservas',
    icon: 'bed-outline',
    loadComponent: () => import('./pages/bookings-page').then((m) => m.BookingsPage),
  },
  {
    path: 'perfil',
    icon: 'person-circle-outline',
    loadComponent: () => import('./pages/profile-page').then((m) => m.ProfilePage),
  },
] as const;

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'mapa' },
  ...tabs.map((tab) =>
    walkOnlyTabs.has(tab.path) ? { ...tab, canActivate: [requireOpenWalk] } : tab,
  ),
  {
    path: 'credencial',
    loadComponent: () => import('./pages/passport-page').then((m) => m.PassportPage),
  },
  {
    path: 'diario',
    loadComponent: () => import('./pages/trail-journal').then((m) => m.TrailJournal),
  },
  { path: '**', redirectTo: 'mapa' },
];
