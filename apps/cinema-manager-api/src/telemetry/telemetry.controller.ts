import {
  Controller,
  Post,
  Body,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
  Inject,
} from '@nestjs/common';
import { TelemetryService } from './telemetry.service';
import { CognitoAuthGuard } from '../auth/cognito-auth.guard';

@Controller('telemetry')
export class TelemetryController {
  constructor(
    @Inject(TelemetryService) private readonly telemetryService: TelemetryService
  ) {}

  @Post('heartbeat')
  @UseGuards(CognitoAuthGuard)
  @HttpCode(HttpStatus.OK)
  async heartbeat(@Req() req: any) {
    const user = req.user;
    if (user?.userId) {
      await this.telemetryService.heartbeat(user.userId, user.email || '');
    }
    return { status: 'alive' };
  }

  @Post('view')
  @HttpCode(HttpStatus.OK)
  async recordMovieView(
    @Body()
    body: {
      id?: string | number;
      title: string;
      year?: number;
      poster?: string;
    }
  ) {
    if (body.title) {
      await this.telemetryService.recordMovieView(body);
    }
    return { recorded: true };
  }
}
