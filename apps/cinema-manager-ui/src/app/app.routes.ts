import { Route } from '@angular/router';
import { authGuard, unauthGuard } from './guards/auth.guard';

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
    path: '**',
    redirectTo: '',
  },
];
