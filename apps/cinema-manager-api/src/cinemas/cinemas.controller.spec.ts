import { Test, TestingModule } from '@nestjs/testing';
import { CinemasController } from './cinemas.controller';
import { CinemasService } from './cinemas.service';

describe('CinemasController', () => {
  let controller: CinemasController;
  let mockCinemasService: Partial<CinemasService>;

  beforeEach(async () => {
    mockCinemasService = {
      getAll: jest.fn().mockResolvedValue([]),
      getById: jest.fn().mockResolvedValue({ id: 1, title: 'Inception' } as any),
      search: jest.fn().mockResolvedValue([]),
      createCinema: jest.fn().mockResolvedValue({ id: 1, title: 'Inception' } as any),
      deleteCinema: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CinemasController],
      providers: [
        { provide: CinemasService, useValue: mockCinemasService },
      ],
    }).compile();

    controller = module.get<CinemasController>(CinemasController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should call getAll on service', async () => {
    const result = await controller.getAll();
    expect(result).toEqual([]);
    expect(mockCinemasService.getAll).toHaveBeenCalled();
  });
});
