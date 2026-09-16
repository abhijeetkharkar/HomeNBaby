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
  private readonly dialog = inject(MatDialog);
  private readonly ngZone = inject(NgZone);

  allCinemas: Cinema[] = [];
  displayedCinemas: Cinema[] = [];
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

    if (device) {
      const wasConnected = this.isAgentConnected;
      this.isAgentConnected = true;
      this.currentDevice = device;
      this.isCheckingDevice = false;
      this.failedPollCount = 0;

      if (!wasConnected || this.allCinemas.length === 0) {
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
    this.applyFilterAndSort();
  }

  clearSearch(): void {
    this.searchQuery = '';
    this.applyFilterAndSort();
  }

  selectGenre(genre: string): void {
    this.selectedGenre = genre;
    this.applyFilterAndSort();
  }

  setSort(sort: string): void {
    this.selectedSort = sort;
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
