import { Injectable, Logger, Inject } from '@nestjs/common';
import { DynamoDbService } from '../dynamodb/dynamodb.service';

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

export interface MovieLeaderboardItem {
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

@Injectable()
export class TelemetryService {
  private readonly logger = new Logger(TelemetryService.name);

  constructor(
    @Inject(DynamoDbService) private readonly dynamoDb: DynamoDbService
  ) {}

  private getDateKeys(customDate?: string) {
    const now = customDate ? new Date(customDate) : new Date();
    const yyyy = now.getUTCFullYear();
    const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(now.getUTCDate()).padStart(2, '0');

    return {
      day: `${yyyy}-${mm}-${dd}`,
      month: `${yyyy}-${mm}`,
      year: `${yyyy}`,
    };
  }

  /**
   * Record a successful user login & register active session heartbeat
   */
  async recordLogin(userId: string, email: string): Promise<void> {
    const { day } = this.getDateKeys();
    const nowEpoch = Math.floor(Date.now() / 1000);
    const ttl = nowEpoch + 15 * 60; // 15 minute active session window

    try {
      // 1. Atomic increment on daily metrics
      await this.dynamoDb.updateItem(
        this.dynamoDb.telemetryTable,
        { pk: `DAILY#${day}`, sk: 'METRICS' },
        'ADD logins :one SET updatedAt = :now',
        { ':one': 1, ':now': new Date().toISOString() }
      );

      // 2. Touch active session
      await this.dynamoDb.updateItem(
        this.dynamoDb.telemetryTable,
        { pk: 'ACTIVE_SESSIONS', sk: `USER#${userId}` },
        'SET email = :email, lastActive = :now, #t = :ttl',
        {
          ':email': email || 'anonymous',
          ':now': new Date().toISOString(),
          ':ttl': ttl,
        },
        { '#t': 'ttl' }
      );
    } catch (error) {
      this.logger.warn('Failed to record login telemetry:', error);
    }
  }

  /**
   * Record a login failure or authentication rejection
   */
  async recordLoginError(email: string, reason: string): Promise<void> {
    const { day } = this.getDateKeys();
    const timestamp = new Date().toISOString();
    const errId = `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    try {
      await this.dynamoDb.updateItem(
        this.dynamoDb.telemetryTable,
        { pk: `DAILY#${day}`, sk: 'METRICS' },
        'ADD loginErrors :one SET updatedAt = :now',
        { ':one': 1, ':now': timestamp }
      );

      await this.dynamoDb.putItem(this.dynamoDb.telemetryTable, {
        pk: `ERRORS#DAY#${day}`,
        sk: `ERR#${timestamp}#${errId}`,
        type: 'LOGIN_ERROR',
        email: email || 'unknown',
        message: reason,
        timestamp,
        ttl: Math.floor(Date.now() / 1000) + 30 * 86400, // Retain errors 30 days
      });
    } catch (error) {
      this.logger.warn('Failed to record login error telemetry:', error);
    }
  }

  /**
   * Heartbeat to keep active session live
   */
  async heartbeat(userId: string, email: string): Promise<void> {
    const nowEpoch = Math.floor(Date.now() / 1000);
    const ttl = nowEpoch + 15 * 60; // 15 minutes

    try {
      await this.dynamoDb.updateItem(
        this.dynamoDb.telemetryTable,
        { pk: 'ACTIVE_SESSIONS', sk: `USER#${userId}` },
        'SET email = :email, lastActive = :now, #t = :ttl',
        {
          ':email': email || 'anonymous',
          ':now': new Date().toISOString(),
          ':ttl': ttl,
        },
        { '#t': 'ttl' }
      );
    } catch (error) {
      this.logger.warn('Failed to update session heartbeat:', error);
    }
  }

  /**
   * Record a cache hit from DynamoDB master movies cache
   */
  async recordCacheHit(
    canonicalKey: string,
    metadata?: { title?: string; year?: number; poster?: string }
  ): Promise<void> {
    const { day, month, year } = this.getDateKeys();
    const timestamp = new Date().toISOString();

    try {
      // Increment daily cache hits
      await this.dynamoDb.updateItem(
        this.dynamoDb.telemetryTable,
        { pk: `DAILY#${day}`, sk: 'METRICS' },
        'ADD cacheHits :one SET updatedAt = :now',
        { ':one': 1, ':now': timestamp }
      );

      // Increment fetch counter on day, month, year
      if (metadata?.title) {
        const itemKey = canonicalKey || metadata.title.toLowerCase().replace(/[^a-z0-9]/g, '');
        const periods = [
          { pk: `FETCHES#DAY#${day}`, sk: `KEY#${itemKey}` },
          { pk: `FETCHES#MONTH#${month}`, sk: `KEY#${itemKey}` },
          { pk: `FETCHES#YEAR#${year}`, sk: `KEY#${itemKey}` },
        ];

        for (const target of periods) {
          await this.dynamoDb.updateItem(
            this.dynamoDb.telemetryTable,
            target,
            'ADD fetchCount :one, cacheHits :one SET title = :t, #y = :yr, poster = :p, updatedAt = :now',
            {
              ':one': 1,
              ':t': metadata.title,
              ':yr': metadata.year || 0,
              ':p': metadata.poster || '',
              ':now': timestamp,
            },
            { '#y': 'year' }
          );
        }
      }
    } catch (error) {
      this.logger.warn('Failed to record cache hit telemetry:', error);
    }
  }

  /**
   * Record an external API call to TMDB or OMDB
   */
  async recordExternalCall(
    service: 'tmdb' | 'omdb',
    success: boolean,
    canonicalKey?: string,
    metadata?: { title?: string; year?: number; poster?: string },
    errorMessage?: string
  ): Promise<void> {
    const { day, month, year } = this.getDateKeys();
    const timestamp = new Date().toISOString();
    const callAttr = service === 'tmdb' ? 'tmdbCalls' : 'omdbCalls';
    const errAttr = service === 'tmdb' ? 'tmdbErrors' : 'omdbErrors';

    try {
      const updateExpr = success
        ? `ADD ${callAttr} :one SET updatedAt = :now`
        : `ADD ${callAttr} :one, ${errAttr} :one SET updatedAt = :now`;

      await this.dynamoDb.updateItem(
        this.dynamoDb.telemetryTable,
        { pk: `DAILY#${day}`, sk: 'METRICS' },
        updateExpr,
        { ':one': 1, ':now': timestamp }
      );

      // Track movie fetch
      if (metadata?.title) {
        const itemKey = canonicalKey || metadata.title.toLowerCase().replace(/[^a-z0-9]/g, '');
        const periods = [
          { pk: `FETCHES#DAY#${day}`, sk: `KEY#${itemKey}` },
          { pk: `FETCHES#MONTH#${month}`, sk: `KEY#${itemKey}` },
          { pk: `FETCHES#YEAR#${year}`, sk: `KEY#${itemKey}` },
        ];

        for (const target of periods) {
          await this.dynamoDb.updateItem(
            this.dynamoDb.telemetryTable,
            target,
            'ADD fetchCount :one, apiCalls :one SET title = :t, #y = :yr, poster = :p, updatedAt = :now',
            {
              ':one': 1,
              ':t': metadata.title,
              ':yr': metadata.year || 0,
              ':p': metadata.poster || '',
              ':now': timestamp,
            },
            { '#y': 'year' }
          );
        }
      }

      // Record error detail if failed
      if (!success && errorMessage) {
        const errId = `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        await this.dynamoDb.putItem(this.dynamoDb.telemetryTable, {
          pk: `ERRORS#DAY#${day}`,
          sk: `ERR#${timestamp}#${errId}`,
          type: service === 'tmdb' ? 'TMDB_ERROR' : 'OMDB_ERROR',
          message: errorMessage,
          timestamp,
          ttl: Math.floor(Date.now() / 1000) + 30 * 86400,
        });
      }
    } catch (error) {
      this.logger.warn(`Failed to record ${service} API telemetry:`, error);
    }
  }

  /**
   * Record a movie playback / watch event
   */
  async recordMovieView(movie: {
    id?: string | number;
    title: string;
    year?: number;
    poster?: string;
  }): Promise<void> {
    const { day, month, year } = this.getDateKeys();
    const timestamp = new Date().toISOString();
    const movieId = String(movie.id || movie.title.toLowerCase().replace(/[^a-z0-9]/g, ''));

    try {
      const periods = [
        { pk: `VIEWS#DAY#${day}`, sk: `MOVIE#${movieId}` },
        { pk: `VIEWS#MONTH#${month}`, sk: `MOVIE#${movieId}` },
        { pk: `VIEWS#YEAR#${year}`, sk: `MOVIE#${movieId}` },
      ];

      for (const target of periods) {
        await this.dynamoDb.updateItem(
          this.dynamoDb.telemetryTable,
          target,
          'ADD viewCount :one SET title = :t, #y = :yr, poster = :p, updatedAt = :now',
          {
            ':one': 1,
            ':t': movie.title,
            ':yr': movie.year || 0,
            ':p': movie.poster || '',
            ':now': timestamp,
          },
          { '#y': 'year' }
        );
      }
    } catch (error) {
      this.logger.warn('Failed to record movie view telemetry:', error);
    }
  }

  /**
   * Retrieve today's KPI metrics and past variable-day history (default 14)
   */
  async getDashboardSummary(days = 14): Promise<{
    today: DailyMetrics;
    liveLogins: number;
    activeSessions: ActiveSession[];
    history: DailyMetrics[];
  }> {
    const numDays = Math.min(Math.max(Number(days) || 14, 7), 60);
    const now = new Date();
    const nowEpoch = Math.floor(now.getTime() / 1000);
    const { day: todayKey } = this.getDateKeys();

    // 1. Fetch live sessions
    let liveLogins = 0;
    let activeSessions: ActiveSession[] = [];
    try {
      const sessions = await this.dynamoDb.query<any>(this.dynamoDb.telemetryTable, {
        keyConditionExpression: 'pk = :pk',
        expressionAttributeValues: { ':pk': 'ACTIVE_SESSIONS' },
      });

      activeSessions = sessions
        .filter((s) => (s.ttl || 0) > nowEpoch)
        .map((s) => ({
          userId: (s.sk || '').replace('USER#', ''),
          email: s.email || 'anonymous',
          lastActive: s.lastActive || '',
          ttl: s.ttl || 0,
        }));
      liveLogins = activeSessions.length;
    } catch (err) {
      this.logger.warn('Failed to query active sessions:', err);
    }

    // 2. Fetch past requested days of metrics in parallel
    const dateStrings: string[] = [];
    for (let i = numDays - 1; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 86400 * 1000);
      dateStrings.push(d.toISOString().split('T')[0]);
    }

    const history = await Promise.all(
      dateStrings.map(async (dateStr) => {
        try {
          const item = await this.dynamoDb.getItem<any>(this.dynamoDb.telemetryTable, {
            pk: `DAILY#${dateStr}`,
            sk: 'METRICS',
          });

          const logins = item?.logins || 0;
          const loginErrors = item?.loginErrors || 0;
          const cacheHits = item?.cacheHits || 0;
          const tmdbCalls = item?.tmdbCalls || 0;
          const tmdbErrors = item?.tmdbErrors || 0;
          const omdbCalls = item?.omdbCalls || 0;
          const omdbErrors = item?.omdbErrors || 0;
          const totalApiCalls = tmdbCalls + omdbCalls;
          const totalRequests = cacheHits + totalApiCalls;
          const cacheHitRatio = totalRequests > 0 ? (cacheHits / totalRequests) * 100 : 100;

          return {
            date: dateStr,
            logins,
            loginErrors,
            cacheHits,
            tmdbCalls,
            tmdbErrors,
            omdbCalls,
            omdbErrors,
            totalApiCalls,
            cacheHitRatio: Math.round(cacheHitRatio * 10) / 10,
          };
        } catch (err) {
          return {
            date: dateStr,
            logins: 0,
            loginErrors: 0,
            cacheHits: 0,
            tmdbCalls: 0,
            tmdbErrors: 0,
            omdbCalls: 0,
            omdbErrors: 0,
            totalApiCalls: 0,
            cacheHitRatio: 100,
          };
        }
      })
    );

    const today = history[history.length - 1] || {
      date: todayKey,
      logins: 0,
      loginErrors: 0,
      cacheHits: 0,
      tmdbCalls: 0,
      tmdbErrors: 0,
      omdbCalls: 0,
      omdbErrors: 0,
      totalApiCalls: 0,
      cacheHitRatio: 100,
    };

    return { today, liveLogins, activeSessions, history };
  }

  /**
   * Top 10 Most Viewed Movies (Day, Month, or Year)
   */
  async getTopViewed(period: 'day' | 'month' | 'year', dateStr?: string): Promise<MovieLeaderboardItem[]> {
    const keys = this.getDateKeys(dateStr);
    const periodKey = keys[period];
    const pk = `VIEWS#${period.toUpperCase()}#${periodKey}`;

    try {
      const items = await this.dynamoDb.query<any>(this.dynamoDb.telemetryTable, {
        keyConditionExpression: 'pk = :pk',
        expressionAttributeValues: { ':pk': pk },
      });

      return items
        .map((item) => ({
          key: (item.sk || '').replace('MOVIE#', ''),
          title: item.title || 'Unknown Title',
          year: item.year || 0,
          poster: item.poster || '',
          count: item.viewCount || 0,
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);
    } catch (err) {
      this.logger.warn(`Failed to fetch top viewed for ${pk}:`, err);
      return [];
    }
  }

  /**
   * Top 10 Most Fetched Movies (Cache or API)
   */
  async getTopFetched(period: 'day' | 'month' | 'year', dateStr?: string): Promise<MovieLeaderboardItem[]> {
    const keys = this.getDateKeys(dateStr);
    const periodKey = keys[period];
    const pk = `FETCHES#${period.toUpperCase()}#${periodKey}`;

    try {
      const items = await this.dynamoDb.query<any>(this.dynamoDb.telemetryTable, {
        keyConditionExpression: 'pk = :pk',
        expressionAttributeValues: { ':pk': pk },
      });

      return items
        .map((item) => ({
          key: (item.sk || '').replace('KEY#', ''),
          title: item.title || 'Unknown Title',
          year: item.year || 0,
          poster: item.poster || '',
          count: item.fetchCount || 0,
          cacheHits: item.cacheHits || 0,
          apiCalls: item.apiCalls || 0,
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);
    } catch (err) {
      this.logger.warn(`Failed to fetch top fetched for ${pk}:`, err);
      return [];
    }
  }

  /**
   * Get recent error logs
   */
  async getRecentErrors(limit = 20): Promise<ErrorEventItem[]> {
    const { day } = this.getDateKeys();
    try {
      const items = await this.dynamoDb.query<any>(this.dynamoDb.telemetryTable, {
        keyConditionExpression: 'pk = :pk',
        expressionAttributeValues: { ':pk': `ERRORS#DAY#${day}` },
        limit,
      });

      return items
        .map((item) => ({
          id: item.sk,
          type: item.type,
          message: item.message,
          details: item.details || item.email,
          timestamp: item.timestamp,
        }))
        .sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''))
        .slice(0, limit);
    } catch (err) {
      this.logger.warn('Failed to query error events:', err);
      return [];
    }
  }
}
