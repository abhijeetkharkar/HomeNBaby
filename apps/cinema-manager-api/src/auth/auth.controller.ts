import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  UseGuards,
  Ip,
  Headers,
} from '@nestjs/common';
import { AuthService, PairDeviceDto, AuditLogDto } from './auth.service';
import { CognitoAuthGuard } from './cognito-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

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
