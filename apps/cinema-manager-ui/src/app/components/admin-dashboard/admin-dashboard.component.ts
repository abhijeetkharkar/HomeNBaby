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
  DailyMetrics,
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

  readonly selectedHistoryDays = signal<number>(14);
  readonly activeHover = signal<{ chart: 'login' | 'cache' | 'api'; point: any } | null>(null);

  readonly historyTotals = computed(() => {
    const s = this.summary();
    if (!s || !s.history || s.history.length === 0) {
      return { logins: 0, cacheHits: 0, apiCalls: 0, avgHitRatio: 100, apiErrors: 0 };
    }
    const logins = s.history.reduce((acc, h) => acc + (h.logins || 0), 0);
    const cacheHits = s.history.reduce((acc, h) => acc + (h.cacheHits || 0), 0);
    const apiCalls = s.history.reduce((acc, h) => acc + (h.totalApiCalls || 0), 0);
    const apiErrors = s.history.reduce((acc, h) => acc + (h.tmdbErrors || 0) + (h.omdbErrors || 0), 0);
    const totalRequests = cacheHits + apiCalls;
    const avgHitRatio = totalRequests > 0 ? Math.round((cacheHits / totalRequests) * 100) : 100;
    return { logins, cacheHits, apiCalls, avgHitRatio, apiErrors };
  });

  readonly chartMilestones = computed(() => {
    const s = this.summary();
    if (!s || !s.history || s.history.length === 0) return [];
    const history = s.history;
    const len = history.length;
    if (len <= 5) {
      return history.map((h, i) => ({
        date: h.date,
        label: i === len - 1 ? 'Today' : h.date.substring(5),
        pct: len === 1 ? 0 : Math.round((i / (len - 1)) * 100),
      }));
    }
    const step = (len - 1) / 4;
    const indices = [0, Math.round(step), Math.round(step * 2), Math.round(step * 3), len - 1];
    const uniqueIndices = Array.from(new Set(indices));
    return uniqueIndices.map((idx) => {
      const item = history[idx];
      const isToday = idx === len - 1;
      return {
        date: item.date,
        label: isToday ? 'Today' : item.date.substring(5),
        pct: Math.round((idx / (len - 1)) * 100),
      };
    });
  });

  readonly loginChartData = computed(() => {
    const s = this.summary();
    return this.buildAreaChart(s?.history || [], (h) => h.logins || 0);
  });

  readonly cacheChartData = computed(() => {
    const s = this.summary();
    return this.buildAreaChart(s?.history || [], (h) => h.cacheHits || 0);
  });

  readonly apiChartData = computed(() => {
    const s = this.summary();
    return this.buildAreaChart(s?.history || [], (h) => h.totalApiCalls || 0);
  });

  private buildAreaChart(
    history: DailyMetrics[],
    valExtractor: (h: DailyMetrics) => number,
    viewWidth = 500,
    viewHeight = 130
  ) {
    if (!history || history.length === 0) {
      return { points: [] as any[], linePath: '', areaPath: '', maxVal: 0, total: 0, hasData: false };
    }
    const padX = 14;
    const padTop = 16;
    const padBottom = 16;
    const baseY = viewHeight - padBottom;
    const usableWidth = viewWidth - 2 * padX;
    const usableHeight = baseY - padTop;

    const rawValues = history.map(valExtractor);
    const total = rawValues.reduce((a, b) => a + b, 0);
    const maxVal = Math.max(...rawValues, 1);
    const len = history.length;

    const points = history.map((h, i) => {
      const v = valExtractor(h);
      const x = padX + (len > 1 ? (i / (len - 1)) * usableWidth : usableWidth / 2);
      const ratio = v / maxVal;
      const y = baseY - ratio * usableHeight;
      return {
        x: Math.round(x * 10) / 10,
        y: Math.round(y * 10) / 10,
        value: v,
        date: h.date,
        dayLabel: h.date.substring(5),
        data: h,
      };
    });

    let linePath = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      const pPrev = points[i - 1];
      const pCurr = points[i];
      const dx = (pCurr.x - pPrev.x) / 2.6;
      linePath += ` C ${(pPrev.x + dx).toFixed(1)} ${pPrev.y.toFixed(1)}, ${(pCurr.x - dx).toFixed(1)} ${pCurr.y.toFixed(1)}, ${pCurr.x.toFixed(1)} ${pCurr.y.toFixed(1)}`;
    }
    const lastX = points[points.length - 1].x;
    const firstX = points[0].x;
    const areaPath = `${linePath} L ${lastX.toFixed(1)} ${baseY} L ${firstX.toFixed(1)} ${baseY} Z`;

    return {
      points,
      linePath,
      areaPath,
      maxVal,
      total,
      hasData: total > 0,
    };
  }

  onChartMouseMove(chart: 'login' | 'cache' | 'api', event: MouseEvent, points: any[]): void {
    if (!points || points.length === 0) return;
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const relativeX = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    const idx = Math.min(Math.max(Math.round(relativeX * (points.length - 1)), 0), points.length - 1);
    this.activeHover.set({ chart, point: points[idx] });
  }

  onChartMouseLeave(): void {
    this.activeHover.set(null);
  }

  async setHistoryDays(days: number): Promise<void> {
    if (this.selectedHistoryDays() === days) return;
    this.selectedHistoryDays.set(days);
    this.activeHover.set(null);
    try {
      const sum = await this.telemetry.getDashboardSummary(days);
      this.summary.set(sum);
    } catch (err) {
      console.error('Failed to change history period:', err);
    }
  }

  getHistoryBadgeLabel(): string {
    const d = this.selectedHistoryDays();
    if (d === 7) return '7d Total';
    if (d === 14) return '14d Total';
    if (d === 30) return '1mo Total';
    if (d === 60) return '2mo Total';
    return `${d}d Total`;
  }

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
        this.telemetry.getDashboardSummary(this.selectedHistoryDays()),
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
