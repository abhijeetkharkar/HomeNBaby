import { Test, TestingModule } from '@nestjs/testing';
import { CinemasService } from './cinemas.service';
import { DynamoDbService } from '../dynamodb/dynamodb.service';
import { MetadataService } from '../metadata/metadata.service';

describe('CinemasService', () => {
  let service: CinemasService;
  let mockDynamoDbService: Partial<DynamoDbService>;
  let mockMetadataService: Partial<MetadataService>;

  beforeEach(async () => {
    mockDynamoDbService = {
      moviesTable: 'cinema-manager-movies',
      scan: jest.fn().mockResolvedValue([
        {
          id: 1,
          title: 'The Matrix',
          year: 1999,
          genre: 'Action, Sci-Fi',
          director: 'Lana Wachowski, Lilly Wachowski',
          actors: 'Keanu Reeves, Laurence Fishburne',
          path: 'C:\\Videos\\The.Matrix.1999.mp4',
        },
      ]),
      getItem: jest.fn().mockResolvedValue({
        id: 1,
        title: 'The Matrix',
        year: 1999,
        genre: 'Action, Sci-Fi',
        path: 'C:\\Videos\\The.Matrix.1999.mp4',
      }),
      putItem: jest.fn().mockResolvedValue(undefined),
      deleteItem: jest.fn().mockResolvedValue(undefined),
    };

    mockMetadataService = {
      enrichMovie: jest.fn().mockResolvedValue({
        title: 'The Matrix',
        year: 1999,
        type: 'movie',
        genre: 'Action, Sci-Fi',
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CinemasService,
        { provide: DynamoDbService, useValue: mockDynamoDbService },
        { provide: MetadataService, useValue: mockMetadataService },
      ],
    }).compile();

    service = module.get<CinemasService>(CinemasService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should get all movies with parsed genres and actorsList', async () => {
    const movies = await service.getAll();
    expect(movies).toHaveLength(1);
    expect(movies[0].title).toBe('The Matrix');
    expect(movies[0].genres).toEqual(['Action', 'Sci-Fi']);
    expect(movies[0].actorsList).toEqual(['Keanu Reeves', 'Laurence Fishburne']);
  });

  it('should search movies by keyword', async () => {
    const results = await service.search('matrix');
    expect(results).toHaveLength(1);
    expect(results[0].title).toBe('The Matrix');
  });
});
