import { Component, OnInit, OnDestroy, inject, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';
import { Cinema } from '@cinema-manager/models';
import { CinemaManagerApiService, DeviceInfo } from '../../services/cinema-manager-api.service';
import { AuthService } from '../../services/auth.service';
import { CinemaComponent } from '../cinema/cinema.component';
import { ConfigurationDialog } from '../configuration-dialog/configuration-dialog.component';

@Component({
  selector: 'app-cinema-gallery',
  templateUrl: './cinema-gallery.component.html',
  styleUrls: ['./cinema-gallery.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatDialogModule,
    MatProgressSpinnerModule,
    MatChipsModule,
    CinemaComponent,
  ],
})
export class CinemaGalleryComponent implements OnInit, OnDestroy {
  private readonly cinemaApiService = inject(CinemaManagerApiService);
  private readonly authService = inject(AuthService, { optional: true });
  private readonly dialog = inject(MatDialog);
  private readonly ngZone = inject(NgZone);
  private isPairingInProgress = false;

  allCinemas: Cinema[] = [];
  displayedCinemas: Cinema[] = [];
  paginatedCinemas: Cinema[] = [];
  pageSize = 10;
  pageIndex = 0;
  pageSizeOptions = [10, 20, 50, 100];
  isLoading = false;
  isCheckingDevice = true;
  isAgentConnected = false;
  currentDevice: DeviceInfo | null = null;
  private devicePollInterval?: any;

  searchQuery = '';
  selectedGenre = 'All';
  selectedSort = 'rating';

  // Client OS detection for tailored download link
  readonly releaseUrlWin =
    'https://github.com/abhijeetkharkar/HomeNBaby/releases/latest/download/cinema-agent-win-x64.zip';
  readonly releaseUrlMac =
    'https://github.com/abhijeetkharkar/HomeNBaby/releases/latest/download/cinema-agent-macos.dmg';

  clientOS: 'windows' | 'macos' | 'linux' | 'other' = 'windows';
  primaryDownloadUrl = this.releaseUrlWin;
  primaryOSLabel = 'Windows (.exe)';
  primaryOSIcon = 'desktop_windows';
  altDownloadUrl = this.releaseUrlMac;
  altOSLabel = 'macOS (.dmg)';

  // Smart Polling backoff
  failedPollCount = 0;
  readonly maxAutoPollAttempts = 3;

  genres: string[] = [
    'All',
    'Action',
    'Adventure',
    'Animation',
    'Comedy',
    'Crime',
    'Drama',
    'Fantasy',
    'Horror',
    'Mystery',
    'Romance',
    'Sci-Fi',
    'Thriller',
  ];

  async ngOnInit(): Promise<void> {
    this.detectClientOS();
    await this.verifyDeviceAndLoad();

    // Smart polling: Auto-poll up to 3 times initially; run outside Angular zone to avoid test/CD stalls
    this.ngZone.runOutsideAngular(() => {
      this.devicePollInterval = setInterval(async () => {
        if (this.cinemaApiService.showPairingModal()) {
          return; // Avoid concurrent polling when wizard modal is open
        }
        if (!this.isAgentConnected) {
          if (this.failedPollCount < this.maxAutoPollAttempts) {
            this.failedPollCount++;
            await this.ngZone.run(() => this.verifyDeviceAndLoad(true));
          }
        } else {
          this.failedPollCount = 0;
        }
      }, 6000);
    });
  }

  detectClientOS(): void {
    if (typeof window === 'undefined' || !window.navigator) return;
    const ua = window.navigator.userAgent.toLowerCase();
    const platform = (
      (window.navigator as any).userAgentData?.platform ||
      window.navigator.platform ||
      ''
    ).toLowerCase();

    if (platform.includes('mac') || ua.includes('macintosh') || ua.includes('mac os')) {
      this.clientOS = 'macos';
      this.primaryDownloadUrl = this.releaseUrlMac;
      this.primaryOSLabel = 'macOS (.dmg)';
      this.primaryOSIcon = 'laptop_mac';
      this.altDownloadUrl = this.releaseUrlWin;
      this.altOSLabel = 'Windows (.exe)';
    } else {
      this.clientOS = 'windows';
      this.primaryDownloadUrl = this.releaseUrlWin;
      this.primaryOSLabel = 'Windows (.exe)';
      this.primaryOSIcon = 'desktop_windows';
      this.altDownloadUrl = this.releaseUrlMac;
      this.altOSLabel = 'macOS (.dmg)';
    }
  }

  openPairingWizard(): void {
    this.cinemaApiService.openPairingModal();
  }

  ngOnDestroy(): void {
    if (this.devicePollInterval) {
      clearInterval(this.devicePollInterval);
      this.devicePollInterval = undefined;
    }
  }

  async verifyDeviceAndLoad(isSilent = false): Promise<void> {
    if (!isSilent) {
      this.isCheckingDevice = true;
      this.failedPollCount = 0; // Manual re-check resets backoff counter
    }

    const device = await this.cinemaApiService.checkLocalDevice();

    if (device && device.status === 'ok') {
      if (!device.isPaired && this.authService && !this.isPairingInProgress) {
        this.isPairingInProgress = true;
        try {
          console.log('[CinemaGallery] Unpaired local agent detected. Auto-pairing...');
          const pairCodeRes = await this.authService.getPairingCode();
          const lookupPaths = await new Promise<string[]>((resolve) => {
            this.cinemaApiService.getLookupPaths().subscribe({
              next: (paths) => resolve(paths.map((p) => p.path)),
              error: () => resolve([]),
            });
          });
          const pairRes = await this.cinemaApiService.pairLocalAgent(pairCodeRes.code, lookupPaths);
          if (pairRes.success) {
            device.isPaired = true;
            device.agentName = pairRes.agentName || device.agentName;
            console.log('[CinemaGallery] Successfully auto-paired agent:', device.agentName);
          } else {
            console.warn('[CinemaGallery] Auto-pair failed:', pairRes.error);
          }
        } catch (err) {
          console.warn('[CinemaGallery] Could not auto-pair agent:', err);
        } finally {
          this.isPairingInProgress = false;
        }
      }

      const wasConnected = this.isAgentConnected;
      this.isAgentConnected = device.isPaired === true;
      this.currentDevice = device;
      this.isCheckingDevice = false;
      this.failedPollCount = 0;

      if ((!wasConnected || this.allCinemas.length === 0) && device.isPaired) {
        this.loadCinemas();
      }
    } else {
      this.isAgentConnected = false;
      this.currentDevice = null;
      this.isCheckingDevice = false;
      this.allCinemas = [];
      this.displayedCinemas = [];
    }
  }

  loadCinemas(): void {
    if (!this.isAgentConnected || !this.currentDevice) {
      return;
    }

    this.isLoading = true;
    this.cinemaApiService.getCinemas(this.currentDevice.agentId).subscribe({
      next: (cinemas) => {
        // Enforce path applicability: ONLY show movies whose paths reside within this device's watched directories
        const verifiedPaths = this.currentDevice?.watchPaths || [];
        console.log(`[CinemaManager] Loaded ${cinemas.length} movies from cloud database. Active watched paths:`, verifiedPaths);

        if (verifiedPaths.length > 0) {
          this.allCinemas = cinemas.filter((c) => this.isPathInWatchedFolder(c.path, verifiedPaths));
          console.log(`[CinemaManager] Matched ${this.allCinemas.length} movies for this device.`);
          if (this.allCinemas.length === 0 && cinemas.length > 0) {
            console.warn(
              '[CinemaManager] 0 movies matched watched paths. Sample movie path from DB:',
              cinemas[0]?.path,
              'vs Watched paths:',
              verifiedPaths
            );
          }
        } else {
          this.allCinemas = cinemas;
        }

        this.applyFilterAndSort();
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading cinemas:', error);
        this.isLoading = false;
      },
    });
  }

  onSearchChange(): void {
    this.pageIndex = 0;
    this.applyFilterAndSort();
  }

  clearSearch(): void {
    this.searchQuery = '';
    this.pageIndex = 0;
    this.applyFilterAndSort();
  }

  selectGenre(genre: string): void {
    this.selectedGenre = genre;
    this.pageIndex = 0;
    this.applyFilterAndSort();
  }

  setSort(sort: string): void {
    this.selectedSort = sort;
    this.pageIndex = 0;
    this.applyFilterAndSort();
  }

  applyFilterAndSort(): void {
    let list = [...this.allCinemas];

    // Filter by search query
    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase().trim();
      list = list.filter((c) => {
        return (
          c.title?.toLowerCase().includes(q) ||
          c.genre?.toLowerCase().includes(q) ||
          c.director?.toLowerCase().includes(q) ||
          c.actors?.toLowerCase().includes(q) ||
          c.plot?.toLowerCase().includes(q)
        );
      });
    }

    // Filter by genre
    if (this.selectedGenre !== 'All') {
      const g = this.selectedGenre.toLowerCase();
      list = list.filter((c) => c.genre?.toLowerCase().includes(g));
    }

    // Sort
    if (this.selectedSort === 'rating') {
      list.sort((a, b) => (b.imdbRating || 0) - (a.imdbRating || 0));
    } else if (this.selectedSort === 'year') {
      list.sort((a, b) => (b.year || 0) - (a.year || 0));
    } else if (this.selectedSort === 'title') {
      list.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
    }

    this.displayedCinemas = list;
    this.updatePagination();
  }

  get totalPages(): number {
    return Math.ceil(this.displayedCinemas.length / this.pageSize) || 1;
  }

  get startIndex(): number {
    return this.pageIndex * this.pageSize;
  }

  get endIndex(): number {
    return Math.min(this.startIndex + this.pageSize, this.displayedCinemas.length);
  }

  updatePagination(): void {
    const maxPageIndex = Math.max(0, Math.ceil(this.displayedCinemas.length / this.pageSize) - 1);
    if (this.pageIndex > maxPageIndex) {
      this.pageIndex = maxPageIndex;
    }
    const startIndex = this.pageIndex * this.pageSize;
    this.paginatedCinemas = this.displayedCinemas.slice(startIndex, startIndex + this.pageSize);
  }

  goToPage(index: number): void {
    if (index < 0 || index >= this.totalPages || index === this.pageIndex) return;
    this.pageIndex = index;
    this.updatePagination();
    this.scrollToTop();
  }

  prevPage(): void {
    if (this.pageIndex > 0) {
      this.goToPage(this.pageIndex - 1);
    }
  }

  nextPage(): void {
    if (this.pageIndex < this.totalPages - 1) {
      this.goToPage(this.pageIndex + 1);
    }
  }

  onPageSizeChange(newSize: any): void {
    this.pageSize = Number(newSize);
    this.pageIndex = 0;
    this.updatePagination();
    this.scrollToTop();
  }

  onPageChange(event: { pageIndex: number; pageSize: number }): void {
    this.pageSize = event.pageSize;
    this.pageIndex = event.pageIndex;
    this.updatePagination();
    this.scrollToTop();
  }

  private scrollToTop(): void {
    if (typeof window !== 'undefined' && typeof window.scrollTo === 'function') {
      try {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } catch {}
    }
  }

  getPageNumbers(): (number | string)[] {
    const total = this.totalPages;
    const current = this.pageIndex + 1; // 1-based for display

    if (total <= 7) {
      return Array.from({ length: total }, (_, i) => i + 1);
    }

    const pages: (number | string)[] = [];

    if (current <= 4) {
      // Near beginning: 1 2 3 4 5 ... total
      for (let i = 1; i <= 5; i++) {
        pages.push(i);
      }
      pages.push('...');
      pages.push(total);
    } else if (current >= total - 3) {
      // Near end: 1 ... total-4 total-3 total-2 total-1 total
      pages.push(1);
      pages.push('...');
      for (let i = total - 4; i <= total; i++) {
        pages.push(i);
      }
    } else {
      // In middle: 1 ... current-1 current current+1 ... total
      pages.push(1);
      pages.push('...');
      pages.push(current - 1);
      pages.push(current);
      pages.push(current + 1);
      pages.push('...');
      pages.push(total);
    }

    return pages;
  }

  deleteCinema(cinema: Cinema): void {
    if (confirm(`Remove "${cinema.title}" from your library?`)) {
      this.cinemaApiService.deleteCinema(cinema.id).subscribe({
        next: () => {
          this.allCinemas = this.allCinemas.filter((c) => c.id !== cinema.id);
          this.applyFilterAndSort();
        },
        error: (err) => {
          console.error('Failed to delete cinema:', err);
          alert('Failed to remove cinema. ' + err.message);
        },
      });
    }
  }

  openSettings(): void {
    const dialogRef = this.dialog.open(ConfigurationDialog, {
      width: '600px',
      panelClass: 'dark-dialog-panel',
    });

    dialogRef.afterClosed().subscribe(() => {
      this.loadCinemas();
    });
  }

  private normalizePath(p: string): string {
    if (!p) return '';
    let clean = p.trim().replace(/^["']|["']$/g, '');
    try {
      clean = decodeURIComponent(clean);
    } catch {}
    clean = clean.replace(/\\+/g, '/').toLowerCase();
    clean = clean.replace(/\/+$/, '');
    return clean;
  }

  private isPathInWatchedFolder(moviePath: string, watchedFolders: string[]): boolean {
    if (!moviePath) return false;
    if (!watchedFolders || watchedFolders.length === 0) return true;

    const normMoviePath = this.normalizePath(moviePath);

    return watchedFolders.some((wp) => {
      const normWp = this.normalizePath(wp);
      if (!normWp) return false;
      return normMoviePath === normWp || normMoviePath.startsWith(normWp + '/');
    });
  }
}
