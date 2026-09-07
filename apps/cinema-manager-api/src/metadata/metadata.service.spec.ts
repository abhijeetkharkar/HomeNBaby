import { Test, TestingModule } from '@nestjs/testing';
import { MetadataService } from './metadata.service';

describe('MetadataService', () => {
  let service: MetadataService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MetadataService],
    }).compile();

    service = module.get<MetadataService>(MetadataService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should clean title correctly and return fallback if not found', async () => {
    const result = await service.enrichMovie('Inception.2010.1080p.BluRay.x264', 2010);
    expect(result).toBeDefined();
    expect(result.type).toBe('movie');
    expect(result.title).toBeDefined();
  });
});
