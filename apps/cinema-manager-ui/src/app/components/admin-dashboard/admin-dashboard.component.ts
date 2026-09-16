import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import {
  TelemetryService,
  DashboardSummaryResponse,
  LeaderboardItem,
  ErrorEventItem,
} from '../../services/telemetry.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
  ],
  templateUrl: './admin-dashboard.component.html',
  styleUrls: ['./admin-dashboard.component.scss'],
})
export class AdminDashboardComponent implements OnInit, OnDestroy {
  private readonly telemetry = inject(TelemetryService);
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly isLoading = signal<boolean>(true);
  readonly summary = signal<DashboardSummaryResponse | null>(null);

  // Leaderboard state
  readonly activeLeaderboardTab = signal<'views' | 'fetches'>('views');
  readonly activePeriod = signal<'day' | 'month' | 'year'>('day');
  readonly topViewed = signal<LeaderboardItem[]>([]);
  readonly topFetched = signal<LeaderboardItem[]>([]);
  readonly isLeaderboardLoading = signal<boolean>(false);

  // Errors state
  readonly recentErrors = signal<ErrorEventItem[]>([]);

  // Auto-refresh timer
  readonly autoRefresh = signal<boolean>(true);
  private refreshIntervalId?: any;

  readonly maxChartHeight = 120; // px for SVG bars

  readonly chartBars = computed(() => {
    const s = this.summary();
    if (!s || !s.history || s.history.length === 0) return [];

    const maxVal = Math.max(
      ...s.history.map((h) => Math.max(h.logins, h.cacheHits, h.totalApiCalls, 1))
    );

    return s.history.map((h) => {
      const loginHeight = Math.max(Math.round((h.logins / maxVal) * this.maxChartHeight), 2);
      const cacheHeight = Math.max(Math.round((h.cacheHits / maxVal) * this.maxChartHeight), 2);
      const apiHeight = Math.max(Math.round((h.totalApiCalls / maxVal) * this.maxChartHeight), 2);

      const dayLabel = h.date.substring(5); // MM-DD
      return {
        ...h,
        dayLabel,
        loginHeight,
        cacheHeight,
        apiHeight,
      };
    });
  });

  ngOnInit(): void {
    this.loadAllData();
    this.startAutoRefresh();
  }

  ngOnDestroy(): void {
    this.stopAutoRefresh();
  }

  toggleAutoRefresh(): void {
    const newVal = !this.autoRefresh();
    this.autoRefresh.set(newVal);
    if (newVal) {
      this.startAutoRefresh();
    } else {
      this.stopAutoRefresh();
    }
  }

  private startAutoRefresh(): void {
    this.stopAutoRefresh();
    if (this.autoRefresh()) {
      this.refreshIntervalId = setInterval(() => {
        this.loadAllData(false);
      }, 30000); // 30s
    }
  }

  private stopAutoRefresh(): void {
    if (this.refreshIntervalId) {
      clearInterval(this.refreshIntervalId);
      this.refreshIntervalId = undefined;
    }
  }

  async loadAllData(showSpinner = true): Promise<void> {
    if (showSpinner) {
      this.isLoading.set(true);
    }
    try {
      const [sum, errors] = await Promise.all([
        this.telemetry.getDashboardSummary(),
        this.telemetry.getRecentErrors(25),
      ]);
      this.summary.set(sum);
      this.recentErrors.set(errors);
      await this.loadCurrentLeaderboard();
    } catch (err) {
      console.error('Failed to fetch admin stats:', err);
    } finally {
      this.isLoading.set(false);
    }
  }

  async setLeaderboardTab(tab: 'views' | 'fetches'): Promise<void> {
    this.activeLeaderboardTab.set(tab);
    await this.loadCurrentLeaderboard();
  }

  async setPeriod(period: 'day' | 'month' | 'year'): Promise<void> {
    this.activePeriod.set(period);
    await this.loadCurrentLeaderboard();
  }

  async loadCurrentLeaderboard(): Promise<void> {
    this.isLeaderboardLoading.set(true);
    const period = this.activePeriod();
    try {
      if (this.activeLeaderboardTab() === 'views') {
        const viewed = await this.telemetry.getTopViewed(period);
        this.topViewed.set(viewed);
      } else {
        const fetched = await this.telemetry.getTopFetched(period);
        this.topFetched.set(fetched);
      }
    } catch (err) {
      console.error('Failed to load leaderboard data:', err);
    } finally {
      this.isLeaderboardLoading.set(false);
    }
  }

  getRankBadgeClass(rank: number): string {
    if (rank === 1) return 'rank-gold';
    if (rank === 2) return 'rank-silver';
    if (rank === 3) return 'rank-bronze';
    return 'rank-default';
  }

  formatDate(isoString: string): string {
    if (!isoString) return '-';
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
      return isoString;
    }
  }
}
