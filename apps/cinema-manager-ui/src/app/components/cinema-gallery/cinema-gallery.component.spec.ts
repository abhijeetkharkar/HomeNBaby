import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { MatDialog } from '@angular/material/dialog';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { CinemaGalleryComponent } from './cinema-gallery.component';
import { CinemaManagerApiService } from '../../services/cinema-manager-api.service';

describe('CinemaGalleryComponent', () => {
  let mockApiService: Partial<CinemaManagerApiService>;
  let mockDialog: Partial<MatDialog>;

  beforeEach(async () => {
    mockApiService = {
      showPairingModal: signal(false),
      openPairingModal: jest.fn(),
      closePairingModal: jest.fn(),
      checkLocalDevice: jest.fn().mockResolvedValue({
        status: 'ok',
        agent: 'cinema-agent',
        isPaired: true,
        agentId: 'agent-test',
        agentName: 'Test Media PC',
        hostname: 'localhost',
        watchPaths: ['C:/Videos', 'C:\\Videos'],
      }),
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

  it('should create and load cinemas on init', async () => {
    const fixture = TestBed.createComponent(CinemaGalleryComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    const component = fixture.componentInstance;

    expect(component).toBeTruthy();
    expect(component.allCinemas.length).toBe(1);
    expect(component.displayedCinemas.length).toBe(1);
    expect(component.displayedCinemas[0].title).toBe('Interstellar');
    fixture.destroy();
  });

  it('should filter cinemas by search query', async () => {
    const fixture = TestBed.createComponent(CinemaGalleryComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    const component = fixture.componentInstance;

    component.searchQuery = 'Matrix';
    component.onSearchChange();

    expect(component.displayedCinemas.length).toBe(0);

    component.searchQuery = 'stellar';
    component.onSearchChange();

    expect(component.displayedCinemas.length).toBe(1);
    fixture.destroy();
  });

  it('should paginate cinemas with default 10 per page and navigate pages', async () => {
    const fixture = TestBed.createComponent(CinemaGalleryComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    const component = fixture.componentInstance;

    const testMovies: any[] = [];
    for (let i = 1; i <= 35; i++) {
      testMovies.push({
        id: i,
        title: `Movie ${i}`,
        path: `C:\\Videos\\Movie${i}.mp4`,
      });
    }
    component.allCinemas = testMovies;
    component.applyFilterAndSort();

    expect(component.pageSize).toBe(10);
    expect(component.displayedCinemas.length).toBe(35);
    expect(component.totalPages).toBe(4);
    expect(component.paginatedCinemas.length).toBe(10);
    expect(component.paginatedCinemas[0].title).toBe('Movie 1');

    // Next page
    component.nextPage();
    expect(component.pageIndex).toBe(1);
    expect(component.paginatedCinemas.length).toBe(10);
    expect(component.paginatedCinemas[0].title).toBe('Movie 11');

    // Go to last page (index 3)
    component.goToPage(3);
    expect(component.pageIndex).toBe(3);
    expect(component.paginatedCinemas.length).toBe(5);
    expect(component.paginatedCinemas[0].title).toBe('Movie 31');

    // Prev page
    component.prevPage();
    expect(component.pageIndex).toBe(2);
    expect(component.paginatedCinemas.length).toBe(10);
    expect(component.paginatedCinemas[0].title).toBe('Movie 21');

    // Change page size to 20
    component.onPageSizeChange(20);
    expect(component.pageSize).toBe(20);
    expect(component.pageIndex).toBe(0);
    expect(component.paginatedCinemas.length).toBe(20);
    expect(component.totalPages).toBe(2);

    fixture.destroy();
  });
});
