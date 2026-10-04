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

  it('should score exact title match with close release year higher than popular partial title match', () => {
    const exactMatchCandidate = {
      id: 191726,
      title: 'Ugly',
      release_date: '2013-05-17',
      original_language: 'hi',
      popularity: 1.26,
    };

    const distantClassicCandidate = {
      id: 429,
      title: 'The Good, the Bad and the Ugly',
      release_date: '1966-12-23',
      original_language: 'it',
      popularity: 26.96,
    };

    const exactScore = (service as any).scoreTmdbCandidate(
      exactMatchCandidate,
      'Ugly',
      2015,
      'hi'
    );

    const classicScore = (service as any).scoreTmdbCandidate(
      distantClassicCandidate,
      'Ugly',
      2015,
      'hi'
    );

    expect(exactScore).toBeGreaterThan(150);
    expect(classicScore).toBeLessThan(50);
    expect(exactScore).toBeGreaterThan(classicScore);
  });

  it('should correctly match close titles ignoring case and leading articles', () => {
    expect((service as any).isCloseTitleMatch('The Matrix', 'Matrix')).toBe(true);
    expect((service as any).isCloseTitleMatch('Ugly', 'Ugly')).toBe(true);
    expect((service as any).isCloseTitleMatch('The Good, the Bad and the Ugly', 'Ugly')).toBe(false);
    expect((service as any).isCloseTitleMatch("You're Ugly Too", 'Ugly')).toBe(false);
  });
});
