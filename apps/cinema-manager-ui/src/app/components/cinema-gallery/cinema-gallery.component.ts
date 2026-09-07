import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';
import { Cinema } from '@cinema-manager/models';
import { CinemaManagerApiService } from '../../services/cinema-manager-api.service';
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
export class CinemaGalleryComponent implements OnInit {
  private readonly cinemaApiService = inject(CinemaManagerApiService);
  private readonly dialog = inject(MatDialog);

  allCinemas: Cinema[] = [];
  displayedCinemas: Cinema[] = [];
  isLoading = true;
  searchQuery = '';
  selectedGenre = 'All';
  selectedSort = 'rating';

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

  ngOnInit(): void {
    this.loadCinemas();
  }

  loadCinemas(): void {
    this.isLoading = true;
    this.cinemaApiService.getCinemas().subscribe({
      next: (cinemas) => {
        this.allCinemas = cinemas;
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
}
