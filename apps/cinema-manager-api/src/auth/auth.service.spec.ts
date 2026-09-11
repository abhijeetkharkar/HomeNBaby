import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { DynamoDbService } from '../dynamodb/dynamodb.service';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';

describe('AuthService', () => {
  let service: AuthService;
  let mockDynamoDb: Partial<DynamoDbService>;

  const mockItems: Record<string, any> = {};

  beforeEach(async () => {
    mockDynamoDb = {
      pairingCodesTable: 'cinema-manager-pairing-codes',
      agentsTable: 'cinema-manager-agents',
      auditLogsTable: 'cinema-manager-audit-logs',
      lookupPathsTable: 'cinema-manager-lookup-paths',
      putItem: jest.fn().mockImplementation(async (table, item) => {
        const key = item.code || item.agentId || item.userId;
        mockItems[`${table}:${key}`] = item;
      }),
      getItem: jest.fn().mockImplementation(async (table, keyObj) => {
        const key = keyObj.code || keyObj.agentId;
        return mockItems[`${table}:${key}`] || null;
      }),
      scan: jest.fn().mockImplementation(async (table) => {
        return Object.entries(mockItems)
          .filter(([k]) => k.startsWith(`${table}:`))
          .map(([, v]) => v);
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: DynamoDbService,
          useValue: mockDynamoDb,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generatePairingCode', () => {
    it('should generate a 6-character code prefixed with CIN-', async () => {
      const result = await service.generatePairingCode('user-123');
      expect(result.code).toMatch(/^CIN-\d{4}$/);
      expect(result.expiresAt).toBeGreaterThan(Math.floor(Date.now() / 1000));
      expect(mockDynamoDb.putItem).toHaveBeenCalledWith(
        'cinema-manager-pairing-codes',
        expect.objectContaining({
          code: result.code,
          userId: 'user-123',
          status: 'PENDING',
        })
      );
    });

    it('should throw BadRequestException if userId is empty', async () => {
      await expect(service.generatePairingCode('')).rejects.toThrow(BadRequestException);
    });
  });

  describe('pairDevice', () => {
    it('should pair device successfully with valid code', async () => {
      const { code } = await service.generatePairingCode('user-456');

      const pairResult = await service.pairDevice(
        {
          code,
          deviceName: 'LivingRoom-PC',
          platform: 'win32',
          agentVersion: '1.0.0',
        },
        '192.168.1.50'
      );

      expect(pairResult.agentToken).toMatch(/^agt_[a-f0-9]{48}$/);
      expect(pairResult.deviceId).toMatch(/^dev_[a-f0-9]{16}$/);

      // Verify audit log was recorded
      expect(mockDynamoDb.putItem).toHaveBeenCalledWith(
        'cinema-manager-audit-logs',
        expect.objectContaining({
          userId: 'user-456',
          eventType: 'AGENT_PAIRED',
          ipAddress: '192.168.1.xxx',
        })
      );
    });

    it('should reject invalid or already consumed code', async () => {
      const { code } = await service.generatePairingCode('user-456');

      // First pairing succeeds
      await service.pairDevice({
        code,
        deviceName: 'Device1',
        platform: 'win32',
      });

      // Second pairing with same code fails
      await expect(
        service.pairDevice({
          code,
          deviceName: 'Device2',
          platform: 'darwin',
        })
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
