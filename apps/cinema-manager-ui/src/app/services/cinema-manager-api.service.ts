import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Observable, throwError } from 'rxjs';
import { catchError, retry } from 'rxjs/operators';
import { Cinema, LookupPath, CinemaAgent } from '@cinema-manager/models';

@Injectable({
  providedIn: 'root',
})
export class CinemaManagerApiService {
  private readonly http = inject(HttpClient);
  private readonly snackBar = inject(MatSnackBar, { optional: true });
  // Default to production API Gateway or local port if in dev mode
  private readonly apiUrl =
    window.location.hostname === 'localhost'
      ? 'http://localhost:3333/cinema-manager'
      : 'https://api.abhijeetkharkar.com/cinema-manager';

  /**
   * Get all cinemas from the API
   */
  getCinemas(): Observable<Cinema[]> {
    return this.http
      .get<Cinema[]>(`${this.apiUrl}/cinemas`)
      .pipe(retry(2), catchError(this.handleError));
  }

  /**
   * Get a specific cinema by ID
   */
  getCinema(id: string | number): Observable<Cinema> {
    return this.http
      .get<Cinema>(`${this.apiUrl}/cinemas/${id}`)
      .pipe(retry(2), catchError(this.handleError));
  }

  /**
   * Search cinemas by title, actor, director, genre
   */
  searchCinemas(query: string): Observable<Cinema[]> {
    return this.http
      .get<Cinema[]>(`${this.apiUrl}/cinemas/search`, {
        params: { q: query },
      })
      .pipe(retry(2), catchError(this.handleError));
  }

  /**
   * Get cinemas by genre
   */
  getCinemasByGenre(genre: string): Observable<Cinema[]> {
    return this.http
      .get<Cinema[]>(`${this.apiUrl}/cinemas/genre/${encodeURIComponent(genre)}`)
      .pipe(retry(2), catchError(this.handleError));
  }

  /**
   * Delete a cinema
   */
  deleteCinema(id: string | number): Observable<void> {
    return this.http
      .delete<void>(`${this.apiUrl}/cinemas/${id}`)
      .pipe(catchError(this.handleError));
  }

  /**
   * Get lookup folder paths
   */
  getLookupPaths(): Observable<LookupPath[]> {
    return this.http
      .get<LookupPath[]>(`${this.apiUrl}/lookup-paths`)
      .pipe(retry(2), catchError(this.handleError));
  }

  /**
   * Add a new lookup folder path
   */
  addLookupPath(path: string): Observable<LookupPath> {
    return this.http
      .post<LookupPath>(`${this.apiUrl}/lookup-paths`, { path })
      .pipe(catchError(this.handleError));
  }

  /**
   * Delete a lookup path
   */
  deleteLookupPath(id: string | number): Observable<void> {
    return this.http
      .delete<void>(`${this.apiUrl}/lookup-paths/${id}`)
      .pipe(catchError(this.handleError));
  }

  /**
   * Get connected agents
   */
  getAgents(): Observable<CinemaAgent[]> {
    return this.http
      .get<CinemaAgent[]>(`${this.apiUrl}/agents`)
      .pipe(retry(2), catchError(this.handleError));
  }

  /**
   * Play or open video file path
   */
  async playVideo(filePath: string): Promise<void> {
    if (!filePath) return;
    try {
      // 1. Try launching through local Cinema Agent HTTP server
      const localAgentUrl = `http://127.0.0.1:3334/open?path=${encodeURIComponent(filePath)}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);

      try {
        const response = await fetch(localAgentUrl, { signal: controller.signal });
        clearTimeout(timeoutId);
        if (response.ok) {
          this.snackBar?.open('🎬 Opening movie in media player...', 'OK', { duration: 3000 });
          return;
        }
      } catch (localErr) {
        clearTimeout(timeoutId);
      }

      // 2. Fallback: Copy to clipboard if agent is not running on this machine
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(filePath);
        this.snackBar?.open('📋 File path copied to clipboard! (Start Cinema Agent for 1-click launch)', 'OK', { duration: 4000 });
      }
    } catch (e) {
      console.warn('Playback handler error:', e);
    }
  }

  /**
   * Handle HTTP errors
   */
  private handleError(error: HttpErrorResponse): Observable<never> {
    let errorMessage = 'An unknown error occurred';
    if (error.error instanceof ErrorEvent) {
      errorMessage = `Network Error: ${error.error.message}`;
    } else {
      errorMessage = `Server Error (${error.status}): ${error.message}`;
    }
    console.error('Cinema API Service Error:', errorMessage, error);
    return throwError(() => new Error(errorMessage));
  }
}