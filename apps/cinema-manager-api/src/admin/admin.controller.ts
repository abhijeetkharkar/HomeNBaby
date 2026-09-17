import { Controller, Get, Query, UseGuards, Inject } from '@nestjs/common';
import { AdminGuard } from '../auth/admin.guard';
import { TelemetryService } from '../telemetry/telemetry.service';

@Controller('admin')
@UseGuards(AdminGuard)
export class AdminController {
  constructor(
    @Inject(TelemetryService) private readonly telemetryService: TelemetryService
  ) {}

  @Get('stats')
  async getStats() {
    return this.telemetryService.getDashboardSummary();
  }

  @Get('leaderboard/views')
  async getTopViewed(
    @Query('period') period: 'day' | 'month' | 'year' = 'day',
    @Query('date') date?: string
  ) {
    const validPeriod = ['day', 'month', 'year'].includes(period) ? period : 'day';
    return this.telemetryService.getTopViewed(validPeriod, date);
  }

  @Get('leaderboard/fetches')
  async getTopFetched(
    @Query('period') period: 'day' | 'month' | 'year' = 'day',
    @Query('date') date?: string
  ) {
    const validPeriod = ['day', 'month', 'year'].includes(period) ? period : 'day';
    return this.telemetryService.getTopFetched(validPeriod, date);
  }

  @Get('errors')
  async getRecentErrors(@Query('limit') limit = 20) {
    const numLimit = Math.min(Number(limit) || 20, 100);
    return this.telemetryService.getRecentErrors(numLimit);
  }
}
