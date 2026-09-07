import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { MatDialog } from '@angular/material/dialog';
import { of } from 'rxjs';
import { CinemaGalleryComponent } from './cinema-gallery.component';
import { CinemaManagerApiService } from '../../services/cinema-manager-api.service';

describe('CinemaGalleryComponent', () => {
  let mockApiService: Partial<CinemaManagerApiService>;
  let mockDialog: Partial<MatDialog>;

  beforeEach(async () => {
    mockApiService = {
      getCinemas: jest.fn().mockReturnValue(
        of([
          {
            id: 1,
            title: 'Interstellar',
            year: 2014,
            genre: 'Sci-Fi, Adventure',
            imdbRating: 8.7,
            path: 'C:\\Videos\\Interstellar.mp4',
            genres: ['Sci-Fi', 'Adventure'],
          } as any,
        ])
      ),
      deleteCinema: jest.fn().mockReturnValue(of(undefined)),
    };

    mockDialog = {
      open: jest.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [CinemaGalleryComponent],
      providers: [
        { provide: CinemaManagerApiService, useValue: mockApiService },
        { provide: MatDialog, useValue: mockDialog },
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    }).compileComponents();
  });

  it('should create and load cinemas on init', () => {
    const fixture = TestBed.createComponent(CinemaGalleryComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    expect(component).toBeTruthy();
    expect(component.allCinemas.length).toBe(1);
    expect(component.displayedCinemas.length).toBe(1);
    expect(component.displayedCinemas[0].title).toBe('Interstellar');
  });

  it('should filter cinemas by search query', () => {
    const fixture = TestBed.createComponent(CinemaGalleryComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    component.searchQuery = 'Matrix';
    component.onSearchChange();

    expect(component.displayedCinemas.length).toBe(0);

    component.searchQuery = 'stellar';
    component.onSearchChange();

    expect(component.displayedCinemas.length).toBe(1);
  });
});
