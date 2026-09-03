import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Cinema } from '@cinema-manager/models';
import { CinemaManagerApiService } from '../../services/cinema-manager-api.service';
import { CinemaComponent } from '../cinema/cinema.component';

@Component({
  selector: 'app-cinema-gallery',
  templateUrl: './cinema-gallery.component.html',
  styleUrls: ['./cinema-gallery.component.scss'],
  standalone: true,
  imports: [CommonModule, MatCardModule, MatButtonModule, MatIconModule, CinemaComponent]
})
export class CinemaGalleryComponent implements OnInit {
  private readonly cinemaApiService = inject(CinemaManagerApiService);

  title = 'Cinema Gallery';
  description = '';

  isLoading = true;
  loadingMessage = '';

  cinemas: Cinema[] = [];
  
  // Configuration UI state
  isFirstTime = false;
  isManageLookupFoldersClicked = false;
  selectedLookupPaths: string[] = [];

  ngOnInit(): void {
    console.log('Cinema Gallery initialized');
    this.loadCinemas();
  }

  private loadCinemas(): void {
    this.isLoading = true;
    this.loadingMessage = 'Loading cinemas...';
    
    this.cinemaApiService.getCinemas().subscribe({
      next: (cinemas) => {
        this.cinemas = cinemas;
        this.isLoading = false;
        console.log('Loaded cinemas:', cinemas);
      },
      error: (error) => {
        console.error('Error loading cinemas:', error);
        this.isLoading = false;
        // TODO: Add proper error notification when Material is configured
        alert('Failed to load cinemas. Please try again.');
      }
    });
  }

  /**
   * Play a video file
   * @param cinema - Cinema object containing file path
   */
  playVideo(cinema: Cinema): void {
    this.cinemaApiService.playVideo(cinema.path);
  }

  /**
   * Refresh the cinema list from the API
   */
  refreshCinemas(): void {
    this.loadCinemas();
  }

  /**
   * Search cinemas by title
   * @param query - Search query
   */
  searchCinemas(query: string): void {
    if (!query.trim()) {
      this.loadCinemas();
      return;
    }

    this.isLoading = true;
    this.loadingMessage = 'Searching cinemas...';
    
    this.cinemaApiService.searchCinemas(query).subscribe({
      next: (cinemas) => {
        this.cinemas = cinemas;
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error searching cinemas:', error);
        this.isLoading = false;
        alert('Search failed. Please try again.');
      }
    });
  }

  /**
   * Delete a cinema
   * @param cinema - Cinema to delete
   */
  deleteCinema(cinema: Cinema): void {
    if (confirm(`Are you sure you want to delete "${cinema.title}"?`)) {
      this.cinemaApiService.deleteCinema(cinema.id.toString()).subscribe({
        next: () => {
          this.cinemas = this.cinemas.filter(c => c.id !== cinema.id);
          alert('Cinema deleted successfully');
        },
        error: (error) => {
          console.error('Error deleting cinema:', error);
          alert('Failed to delete cinema');
        }
      });
    }
  }

  /**
   * Browse for folder paths to add to lookup paths
   */
  browse(): void {
    // In web app, this would need to be replaced with a different approach
    // For now, just show a placeholder
    alert('Folder selection not yet implemented in web version');
  }

  /**
   * Finish adding lookup paths and refresh cinema list
   */
  finishAddingLookupPaths(): void {
    this.isFirstTime = false;
    this.isManageLookupFoldersClicked = false;
    this.loadCinemas();
  }

  /**
   * Remove a path from the lookup paths
   * @param index - Index of the path to remove
   */
  removeFromLookupPaths(index: number): void {
    this.selectedLookupPaths.splice(index, 1);
  }
}
