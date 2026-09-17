import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  UseGuards,
  Ip,
  Headers,
  Inject,
  Optional,
} from '@nestjs/common';
import { AuthService, PairDeviceDto, AuditLogDto } from './auth.service';
import { CognitoAuthGuard } from './cognito-auth.guard';
import { TelemetryService } from '../telemetry/telemetry.service';

@Controller('auth')
export class AuthController {
  constructor(
    @Inject(AuthService) private readonly authService: AuthService,
    @Optional() @Inject(TelemetryService) private readonly telemetryService?: TelemetryService
  ) {}

  /**
   * Record successful user login telemetry
   */
  @Post('record-login')
  @UseGuards(CognitoAuthGuard)
  async recordLogin(@Req() req: any) {
    const user = req.user;
    if (user?.userId && this.telemetryService) {
      await this.telemetryService.recordLogin(user.userId, user.email || '');
    }
    return { recorded: true };
  }

  /**
   * Record login failure telemetry
   */
  @Post('record-login-error')
  async recordLoginError(@Body() body: { email: string; error?: string }) {
    if (body?.email && this.telemetryService) {
      await this.telemetryService.recordLoginError(body.email, body.error || 'Unknown login error');
    }
    return { recorded: true };
  }

  /**
   * Generates a 6-digit pairing code for the authenticated user
   */
  @Post('pairing-code')
  @UseGuards(CognitoAuthGuard)
  async generatePairingCode(@Req() req: any) {
    const userId = req.user?.userId;
    return this.authService.generatePairingCode(userId);
  }

  /**
   * Public endpoint called by Desktop Agent to exchange pairing code for an Agent Token
   */
  @Post('pair-device')
  async pairDevice(
    @Body() dto: PairDeviceDto,
    @Ip() ip: string,
    @Headers('x-forwarded-for') forwardedFor?: string
  ) {
    const clientIp = forwardedFor ? forwardedFor.split(',')[0].trim() : ip;
    return this.authService.pairDevice(dto, clientIp);
  }

  /**
   * Logs an audit event (pairing, heartbeat, scanning, etc.)
   */
  @Post('audit-log')
  async logAuditEvent(
    @Body() dto: AuditLogDto,
    @Ip() ip: string,
    @Headers('x-forwarded-for') forwardedFor?: string
  ) {
    const clientIp = forwardedFor ? forwardedFor.split(',')[0].trim() : ip;
    await this.authService.logAuditEvent({
      ...dto,
      ipAddress: clientIp,
    });
    return { success: true };
  }

  /**
   * Verify token status and return identity
   */
  @Get('verify')
  @UseGuards(CognitoAuthGuard)
  async verifySession(@Req() req: any) {
    return {
      authenticated: true,
      user: req.user,
    };
  }
}
