import { Test, TestingModule } from '@nestjs/testing';
import { TelemetryService } from './telemetry.service';
import { DynamoDbService } from '../dynamodb/dynamodb.service';

describe('TelemetryService', () => {
  let service: TelemetryService;
  const mockDynamoDb = {
    telemetryTable: 'cinema-manager-telemetry',
    updateItem: jest.fn(),
    putItem: jest.fn(),
    getItem: jest.fn(),
    query: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TelemetryService,
        {
          provide: DynamoDbService,
          useValue: mockDynamoDb,
        },
      ],
    }).compile();

    service = module.get<TelemetryService>(TelemetryService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should record login telemetry atomically', async () => {
    mockDynamoDb.updateItem.mockResolvedValue({});

    await service.recordLogin('user-1', 'admin@cinema.local');

    expect(mockDynamoDb.updateItem).toHaveBeenCalledTimes(2);
    expect(mockDynamoDb.updateItem).toHaveBeenCalledWith(
      'cinema-manager-telemetry',
      expect.objectContaining({ sk: 'METRICS' }),
      expect.stringContaining('ADD logins :one'),
      expect.any(Object)
    );
  });

  it('should update active session heartbeat', async () => {
    mockDynamoDb.updateItem.mockResolvedValue({});

    await service.heartbeat('user-1', 'admin@cinema.local');

    expect(mockDynamoDb.updateItem).toHaveBeenCalledWith(
      'cinema-manager-telemetry',
      { pk: 'ACTIVE_SESSIONS', sk: 'USER#user-1' },
      expect.stringContaining('SET email = :email'),
      expect.objectContaining({ ':email': 'admin@cinema.local' }),
      expect.objectContaining({ '#t': 'ttl' })
    );
  });

  it('should return dashboard summary without throwing', async () => {
    mockDynamoDb.query.mockResolvedValueOnce([
      {
        pk: 'ACTIVE_SESSIONS',
        sk: 'USER#user-1',
        email: 'admin@cinema.local',
        lastActive: new Date().toISOString(),
        ttl: Math.floor(Date.now() / 1000) + 600,
      },
    ]);
    mockDynamoDb.getItem.mockResolvedValue({
      logins: 5,
      cacheHits: 20,
      tmdbCalls: 10,
    });

    const summary = await service.getDashboardSummary();

    expect(summary).toBeDefined();
    expect(summary.liveLogins).toBe(1);
    expect(summary.activeSessions.length).toBe(1);
    expect(summary.history.length).toBe(14);
    expect(summary.today).toBeDefined();
  });
});
