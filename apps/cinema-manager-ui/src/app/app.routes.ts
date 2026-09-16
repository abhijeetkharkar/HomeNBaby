import { Route } from '@angular/router';
import { authGuard, unauthGuard } from './guards/auth.guard';
import { adminGuard } from './guards/admin.guard';

export const appRoutes: Route[] = [
  {
    path: '',
    loadComponent: () =>
      import(
        './components/showcase-landing/showcase-landing.component'
      ).then((m) => m.ShowcaseLandingComponent),
  },
  {
    path: 'login',
    canActivate: [unauthGuard],
    loadComponent: () =>
      import('./components/auth/auth.component').then((m) => m.AuthComponent),
  },
  {
    path: 'dashboard',
    canActivate: [authGuard],
    loadComponent: () =>
      import(
        './components/cinema-gallery/cinema-gallery.component'
      ).then((m) => m.CinemaGalleryComponent),
  },
  {
    path: 'admin',
    canActivate: [adminGuard],
    loadComponent: () =>
      import(
        './components/admin-dashboard/admin-dashboard.component'
      ).then((m) => m.AdminDashboardComponent),
  },
  {
    path: '**',
    redirectTo: '',
  },
];
