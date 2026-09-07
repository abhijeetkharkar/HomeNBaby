import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { CinemaComponent } from './cinema.component';
import { Cinema } from '@cinema-manager/models';

describe('CinemaComponent', () => {
  const mockCinema: Cinema = {
    id: 1,
    path: 'C:\\Videos\\Inception.mp4',
    imdbId: 'tt1375666',
    tmdbId: 27205,
    type: 'movie',
    title: 'Inception',
    year: 2010,
    releaseDate: '2010-07-16',
    rated: 'PG-13',
    runtime: 148,
    genre: 'Action, Sci-Fi',
    plot: 'A thief who steals corporate secrets...',
    imdbRating: 8.8,
    imdbVotes: '2500000',
    metascore: 74,
    poster: 'https://image.tmdb.org/t/p/w500/path.jpg',
    quality: '1080p',
    showCinema: 1,
    lastUpdatedDate: '2026-09-06',
    genres: ['Action', 'Sci-Fi'],
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CinemaComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
  });

  it('should create the component and display title', () => {
    const fixture = TestBed.createComponent(CinemaComponent);
    const component = fixture.componentInstance;
    component.cinema = mockCinema;
    fixture.detectChanges();

    expect(component).toBeTruthy();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.movie-title')?.textContent).toContain('Inception');
  });
});
