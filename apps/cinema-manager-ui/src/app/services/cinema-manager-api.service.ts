import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Observable, throwError } from 'rxjs';
import { catchError, retry } from 'rxjs/operators';
import { Cinema, LookupPath, CinemaAgent } from '@cinema-manager/models';

export interface DeviceInfo {
  status: string;
  agent: string;
  agentId: string;
  agentName: string;
  machineName?: string;
  hostname: string;
  platform?: string;
  watchPaths: string[];
  isPaired?: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class CinemaManagerApiService {
  private readonly http = inject(HttpClient);
  private readonly snackBar = inject(MatSnackBar, { optional: true });

  readonly showPairingModal = signal<boolean>(false);

  openPairingModal(): void {
    this.showPairingModal.set(true);
  }

  closePairingModal(): void {
    this.showPairingModal.set(false);
  }

  // Default to production API Gateway or local port if in dev mode
  private readonly apiUrl =
    window.location.hostname === 'localhost'
      ? 'http://localhost:3333/cinema-manager'
      : 'https://api.abhijeetkharkar.com/cinema-manager';

  /**
   * Check if local Cinema Manager Agent is active on this device
   */
  async checkLocalDevice(): Promise<DeviceInfo | null> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1500);

      const response = await fetch('http://127.0.0.1:3334/device-info', {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        return (await response.json()) as DeviceInfo;
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Directly pair local agent via HTTP loopback
   */
  async pairLocalAgent(
    pairingCode: string,
    watchPaths?: string[]
  ): Promise<{ success: boolean; deviceId?: string; agentName?: string; error?: string }> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch('http://127.0.0.1:3334/pair', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pairingCode,
          watchPaths,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      return (await response.json()) as any;
    } catch (err: any) {
      console.warn('Failed to pair local agent over loopback:', err);
      return { success: false, error: err.message };
    }
  }

  /**
   * Dynamically update watched paths on local agent
   */
  async updateLocalAgentPaths(watchPaths: string[]): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      const response = await fetch('http://127.0.0.1:3334/config/paths', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ watchPaths }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Get all cinemas from the API, optionally scoped to an agentId
   */
  getCinemas(agentId?: string): Observable<Cinema[]> {
    const params: Record<string, string> = {};
    if (agentId) {
      params['agentId'] = agentId;
    }
    return this.http
      .get<Cinema[]>(`${this.apiUrl}/cinemas`, { params })
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
  async playVideo(filePath: string, title?: string): Promise<void> {
    if (!filePath) return;
    try {
      // 1. Try launching through local Cinema Agent HTTP server
      const localAgentUrl = `http://127.0.0.1:3334/open?path=${encodeURIComponent(filePath)}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      try {
        const response = await fetch(localAgentUrl, { signal: controller.signal });
        clearTimeout(timeoutId);
        if (response.ok) {
          const display = title ? `"${title}"` : 'movie';
          this.snackBar?.open(`🎬 Opening ${display} in VLC...`, 'Dismiss', {
            duration: 4000,
            horizontalPosition: 'center',
            verticalPosition: 'bottom',
            panelClass: ['cinema-prominent-snackbar'],
          });
          return;
        } else {
          const errData = await response.json().catch(() => null);
          const errorMsg = errData?.error || `HTTP ${response.status}`;
          this.snackBar?.open(`⚠️ Playback error: ${errorMsg}`, 'Dismiss', {
            duration: 5000,
            horizontalPosition: 'center',
            verticalPosition: 'bottom',
            panelClass: ['cinema-prominent-snackbar', 'cinema-error-snackbar'],
          });
          return;
        }
      } catch (localErr) {
        clearTimeout(timeoutId);
      }

      // 2. Fallback: Copy to clipboard if agent is not running on this machine
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(filePath);
        this.snackBar?.open('📋 File path copied to clipboard! (Start Cinema Agent for 1-click launch)', 'Dismiss', {
          duration: 4500,
          horizontalPosition: 'center',
          verticalPosition: 'bottom',
          panelClass: ['cinema-prominent-snackbar'],
        });
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