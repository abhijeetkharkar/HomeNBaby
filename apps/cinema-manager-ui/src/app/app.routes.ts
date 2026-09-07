import { Route } from '@angular/router';

export const appRoutes: Route[] = [
  {
    path: '',
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
