import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { AuthService } from './auth.service';

export interface DailyMetrics {
  date: string;
  logins: number;
  loginErrors: number;
  cacheHits: number;
  tmdbCalls: number;
  tmdbErrors: number;
  omdbCalls: number;
  omdbErrors: number;
  totalApiCalls: number;
  cacheHitRatio: number;
}

export interface ActiveSession {
  userId: string;
  email: string;
  lastActive: string;
  ttl: number;
}

export interface DashboardSummaryResponse {
  today: DailyMetrics;
  liveLogins: number;
  activeSessions: ActiveSession[];
  history: DailyMetrics[];
}

export interface LeaderboardItem {
  key: string;
  title: string;
  year?: number;
  poster?: string;
  count: number;
  cacheHits?: number;
  apiCalls?: number;
}

export interface ErrorEventItem {
  id: string;
  type: 'TMDB_ERROR' | 'OMDB_ERROR' | 'LOGIN_ERROR' | 'SYSTEM_ERROR';
  message: string;
  details?: string;
  timestamp: string;
}

@Injectable({
  providedIn: 'root',
})
export class TelemetryService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);

  private readonly apiUrl =
    window.location.hostname === 'localhost'
      ? 'http://localhost:3333/cinema-manager'
      : 'https://api.abhijeetkharkar.com/cinema-manager';

  private async getAuthHeaders(): Promise<HttpHeaders> {
    const token = (await this.auth.getValidToken()) || '';
    return new HttpHeaders({
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    });
  }

  async getDashboardSummary(): Promise<DashboardSummaryResponse> {
    const headers = await this.getAuthHeaders();
    return firstValueFrom(
      this.http.get<DashboardSummaryResponse>(`${this.apiUrl}/admin/stats`, {
        headers,
      })
    );
  }

  async getTopViewed(period: 'day' | 'month' | 'year' = 'day'): Promise<LeaderboardItem[]> {
    const headers = await this.getAuthHeaders();
    return firstValueFrom(
      this.http.get<LeaderboardItem[]>(
        `${this.apiUrl}/admin/leaderboard/views?period=${period}`,
        { headers }
      )
    );
  }

  async getTopFetched(period: 'day' | 'month' | 'year' = 'day'): Promise<LeaderboardItem[]> {
    const headers = await this.getAuthHeaders();
    return firstValueFrom(
      this.http.get<LeaderboardItem[]>(
        `${this.apiUrl}/admin/leaderboard/fetches?period=${period}`,
        { headers }
      )
    );
  }

  async getRecentErrors(limit = 20): Promise<ErrorEventItem[]> {
    const headers = await this.getAuthHeaders();
    return firstValueFrom(
      this.http.get<ErrorEventItem[]>(`${this.apiUrl}/admin/errors?limit=${limit}`, {
        headers,
      })
    );
  }

  async sendHeartbeat(): Promise<void> {
    try {
      const headers = await this.getAuthHeaders();
      await firstValueFrom(
        this.http.post(
          `${this.apiUrl}/telemetry/heartbeat`,
          {},
          { headers }
        )
      );
    } catch {
      // Non-blocking
    }
  }

  async recordView(movie: {
    id?: string | number;
    title: string;
    year?: number;
    poster?: string;
  }): Promise<void> {
    try {
      await firstValueFrom(
        this.http.post(`${this.apiUrl}/telemetry/view`, movie)
      );
    } catch {
      // Non-blocking
    }
  }
}
