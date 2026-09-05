import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, retry } from 'rxjs/operators';
import { Cinema } from '@cinema-manager/models';

@Injectable({
  providedIn: 'root'
})
export class CinemaManagerApiService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = 'https://api.abhijeetkharkar.com/cinema-manager';

  /**
   * Get all cinemas from the API
   * @returns Observable of Cinema array
   */
  getCinemas(): Observable<Cinema[]> {
    return this.http.get<Cinema[]>(`${this.apiUrl}/cinemas`)
      .pipe(
        retry(3),
        catchError(this.handleError)
      );
  }

  /**
   * Get a specific cinema by ID
   * @param id - Cinema ID
   * @returns Observable of Cinema
   */
  getCinema(id: string): Observable<Cinema> {
    return this.http.get<Cinema>(`${this.apiUrl}/cinemas/${id}`)
      .pipe(
        retry(3),
        catchError(this.handleError)
      );
  }

  /**
   * Search cinemas by title or other criteria
   * @param query - Search query
   * @returns Observable of Cinema array
   */
  searchCinemas(query: string): Observable<Cinema[]> {
    return this.http.get<Cinema[]>(`${this.apiUrl}/cinemas/search`, {
      params: { q: query }
    }).pipe(
      retry(3),
      catchError(this.handleError)
    );
  }

  /**
   * Get cinemas by genre
   * @param genre - Genre name
   * @returns Observable of Cinema array
   */
  getCinemasByGenre(genre: string): Observable<Cinema[]> {
    return this.http.get<Cinema[]>(`${this.apiUrl}/cinemas/genre/${genre}`)
      .pipe(
        retry(3),
        catchError(this.handleError)
      );
  }

  /**
   * Delete a cinema
   * @param id - Cinema ID
   * @returns Observable of void
   */
  deleteCinema(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/cinemas/${id}`)
      .pipe(
        retry(3),
        catchError(this.handleError)
      );
  }

  /**
   * Play a video file using the system's default player
   * This will attempt to open the file path in the default video player
   * @param filePath - Full path to the video file
   */
  playVideo(filePath: string): void {
    try {
      // For web applications, we need to handle this differently than Electron
      // Option 1: Create a download link
      const link = document.createElement('a');
      link.href = `file:///${filePath.replace(/\\/g, '/')}`;
      link.target = '_blank';
      link.click();
      
      // Option 2: Alternative approach - notify user to manually open
      // This might be more reliable in web context
      console.log(`Attempting to play video: ${filePath}`);
      
      // Could also implement a file server endpoint in the API
      // that serves video files for streaming
    } catch (error) {
      console.error('Error playing video:', error);
      // Fallback: show user the file path to manually open
      alert(`Please manually open the video file at: ${filePath}`);
    }
  }

  /**
   * Handle HTTP errors
   * @param error - HTTP error response
   * @returns Observable error
   */
  private handleError(error: HttpErrorResponse): Observable<never> {
    let errorMessage = 'An unknown error occurred';
    
    if (error.error instanceof ErrorEvent) {
      // Client-side error
      errorMessage = `Client Error: ${error.error.message}`;
    } else {
      // Server-side error
      errorMessage = `Server Error ${error.status}: ${error.message}`;
      
      // Handle specific HTTP status codes
      switch (error.status) {
        case 401:
          errorMessage = 'Unauthorized. Please check your authentication.';
          break;
        case 403:
          errorMessage = 'Forbidden. You do not have permission to access this resource.';
          break;
        case 404:
          errorMessage = 'Resource not found.';
          break;
        case 500:
          errorMessage = 'Internal server error. Please try again later.';
          break;
      }
    }
    
    console.error('Cinema API Error:', errorMessage, error);
    return throwError(() => new Error(errorMessage));
  }
}