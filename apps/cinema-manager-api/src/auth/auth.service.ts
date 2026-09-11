import {
  Injectable,
  Logger,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { DynamoDbService } from '../dynamodb/dynamodb.service';

export interface PairingCodeRecord {
  code: string;
  userId: string;
  expiresAt: number; // Unix timestamp in seconds
  status: 'PENDING' | 'CONSUMED';
  createdAt: string;
}

export interface PairDeviceDto {
  code: string;
  deviceName: string;
  platform: string;
  agentVersion?: string;
  localIp?: string;
}

export interface AuditLogDto {
  userId?: string;
  deviceId?: string;
  eventType: string;
  osPlatform?: string;
  agentVersion?: string;
  ipAddress?: string;
  details?: Record<string, any>;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(private readonly dynamoDb: DynamoDbService) {}

  /**
   * Generates an ephemeral 6-character Pairing Code with 10-minute TTL for a logged-in user
   */
  async generatePairingCode(userId: string): Promise<{ code: string; expiresAt: number }> {
    if (!userId) {
      throw new BadRequestException('userId is required to generate a pairing code');
    }

    // High entropy 4-digit code prefixed with CIN- (e.g., CIN-4829)
    const randomDigits = Math.floor(1000 + Math.random() * 9000);
    const code = `CIN-${randomDigits}`;
    const expiresAt = Math.floor(Date.now() / 1000) + 600; // 10 minutes

    const record: PairingCodeRecord = {
      code,
      userId,
      expiresAt,
      status: 'PENDING',
      createdAt: new Date().toISOString(),
    };

    await this.dynamoDb.putItem(this.dynamoDb.pairingCodesTable, record);
    this.logger.log(`Generated pairing code ${code} for user ${userId} (expires in 10m)`);

    return { code, expiresAt };
  }

  /**
   * Exchanges a Pairing Code from the Desktop Agent for a persistent scoped Agent Token
   */
  async pairDevice(
    dto: PairDeviceDto,
    clientIp?: string
  ): Promise<{ agentToken: string; deviceId: string; watchPaths: string[] }> {
    const { code, deviceName, platform, agentVersion } = dto;

    if (!code) {
      throw new BadRequestException('Pairing code is required');
    }

    const normalizedCode = code.trim().toUpperCase();
    const record = await this.dynamoDb.getItem<PairingCodeRecord>(
      this.dynamoDb.pairingCodesTable,
      { code: normalizedCode }
    );

    if (!record) {
      throw new UnauthorizedException('Invalid or expired pairing code');
    }

    const currentEpoch = Math.floor(Date.now() / 1000);
    if (record.status !== 'PENDING' || currentEpoch > record.expiresAt) {
      throw new UnauthorizedException('Pairing code has already been used or expired');
    }

    // Mark pairing code as CONSUMED
    await this.dynamoDb.putItem(this.dynamoDb.pairingCodesTable, {
      ...record,
      status: 'CONSUMED',
      consumedAt: new Date().toISOString(),
      consumedByDevice: deviceName || 'Unknown Device',
    });

    // Generate secure agent token
    const agentToken = `agt_${crypto.randomBytes(24).toString('hex')}`;
    const deviceId = `dev_${crypto.randomBytes(8).toString('hex')}`;

    // Look up user's configured paths or default
    let watchPaths: string[] = [];
    try {
      const paths = await this.dynamoDb.scan<any>(this.dynamoDb.lookupPathsTable);
      if (paths && paths.length > 0) {
        watchPaths = paths.map((p) => p.path);
      }
    } catch (pathErr) {
      this.logger.warn('Could not fetch lookup paths during pairing:', pathErr);
    }

    // Register / update agent in agents table
    await this.dynamoDb.putItem(this.dynamoDb.agentsTable, {
      agentId: deviceId,
      agentName: deviceName || 'Desktop Agent',
      agentToken,
      userId: record.userId,
      platform: platform || 'unknown',
      agentVersion: agentVersion || '1.0.0',
      pairedAt: new Date().toISOString(),
      lastSeen: new Date().toISOString(),
      watchPaths,
    });

    // Write audit log
    await this.logAuditEvent({
      userId: record.userId,
      deviceId,
      eventType: 'AGENT_PAIRED',
      osPlatform: platform,
      agentVersion,
      ipAddress: this.anonymizeIp(clientIp),
      details: {
        deviceName,
        pairingCode: normalizedCode,
      },
    });

    this.logger.log(`Device "${deviceName}" (${deviceId}) successfully paired with user ${record.userId}`);

    return { agentToken, deviceId, watchPaths };
  }

  /**
   * Logs an audit event to cinema-manager-audit-logs
   */
  async logAuditEvent(event: AuditLogDto): Promise<void> {
    const timestamp = new Date().toISOString();
    const item = {
      userId: event.userId || 'anonymous',
      timestamp,
      deviceId: event.deviceId || 'unknown',
      eventType: event.eventType,
      osPlatform: event.osPlatform || 'unknown',
      agentVersion: event.agentVersion || 'unknown',
      ipAddress: this.anonymizeIp(event.ipAddress),
      details: event.details || {},
    };

    try {
      await this.dynamoDb.putItem(this.dynamoDb.auditLogsTable, item);
    } catch (err) {
      this.logger.warn('Failed to write audit log:', err);
    }
  }

  /**
   * Validates an Agent Token from headers
   */
  async validateAgentToken(agentToken: string): Promise<any | null> {
    if (!agentToken) return null;
    try {
      // Find agent matching this token
      const agents = await this.dynamoDb.scan<any>(this.dynamoDb.agentsTable);
      const agent = agents.find((a) => a.agentToken === agentToken);
      return agent || null;
    } catch (err) {
      this.logger.warn('Error validating agent token:', err);
      return null;
    }
  }

  private anonymizeIp(ip?: string): string {
    if (!ip) return 'unknown';
    // If IPv4: mask last octet (e.g. 192.168.1.xxx)
    const ipv4Match = ip.match(/^(\d{1,3}\.\d{1,3}\.\d{1,3})\.\d{1,3}$/);
    if (ipv4Match) {
      return `${ipv4Match[1]}.xxx`;
    }
    return ip;
  }
}
