import { Test, TestingModule } from '@nestjs/testing';
import { MetadataService } from './metadata.service';
import { DynamoDbService } from '../dynamodb/dynamodb.service';

describe('MetadataService', () => {
  let service: MetadataService;
  const mockDynamoDb = {
    masterMoviesTable: 'cinema-manager-master-movies',
    getItem: jest.fn(),
    putItem: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MetadataService,
        {
          provide: DynamoDbService,
          useValue: mockDynamoDb,
        },
      ],
    }).compile();

    service = module.get<MetadataService>(MetadataService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should clean title correctly and return fallback if not found', async () => {
    mockDynamoDb.getItem.mockResolvedValueOnce(null);
    const result = await service.enrichMovie('Inception.2010.1080p.BluRay.x264', 2010);
    expect(result).toBeDefined();
    expect(result.type).toBe('movie');
    expect(result.title).toBeDefined();
  });

  it('should return cached metadata instantly on master cache hit', async () => {
    const cachedRecord = {
      canonicalKey: 'thematrix_1999',
      metadata: {
        title: 'The Matrix',
        year: 1999,
        type: 'movie',
        poster: 'https://image.tmdb.org/matrix.jpg',
        imdbRating: 8.7,
      },
    };
    mockDynamoDb.getItem.mockResolvedValueOnce(cachedRecord);

    const result = await service.enrichMovie('The.Matrix.1999.mkv');
    expect(result.title).toBe('The Matrix');
    expect(result.imdbRating).toBe(8.7);
    expect(mockDynamoDb.getItem).toHaveBeenCalledWith(
      'cinema-manager-master-movies',
      { canonicalKey: 'thematrix_1999' }
    );
  });
});
