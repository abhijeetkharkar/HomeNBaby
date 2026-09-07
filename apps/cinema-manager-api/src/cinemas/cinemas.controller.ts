import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  Body,
  HttpCode,
  HttpStatus,
  Inject,
} from '@nestjs/common';
import { CinemasService } from './cinemas.service';
import { CreateCinemaDto } from '@cinema-manager/models';

@Controller('cinemas')
export class CinemasController {
  constructor(
    @Inject(CinemasService) private readonly cinemasService: CinemasService
  ) {}

  @Get()
  async getAll(@Query('agentId') agentId?: string) {
    return this.cinemasService.getAll();
  }

  @Get('search')
  async search(@Query('q') query?: string) {
    return this.cinemasService.search(query || '');
  }

  @Get('by-path')
  async getByPath(
    @Query('filePath') filePath: string,
    @Query('agentId') agentId?: string
  ) {
    return this.cinemasService.getByPath(filePath, agentId);
  }

  @Get('genre/:genre')
  async getByGenre(@Param('genre') genre: string) {
    return this.cinemasService.getByGenre(genre);
  }

  @Get(':id')
  async getById(@Param('id') id: string) {
    return this.cinemasService.getById(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createCinema(@Body() dto: CreateCinemaDto) {
    return this.cinemasService.createCinema(dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteCinema(@Param('id') id: string) {
    await this.cinemasService.deleteCinema(id);
  }
}

// Sub-controller to support /api/cinemas prefix expected by some clients/agents
@Controller('api/cinemas')
export class ApiCinemasController {
  constructor(
    @Inject(CinemasService) private readonly cinemasService: CinemasService
  ) {}

  @Get()
  async getAll(@Query('agentId') agentId?: string) {
    return this.cinemasService.getAll();
  }

  @Get('search')
  async search(@Query('q') query?: string) {
    return this.cinemasService.search(query || '');
  }

  @Get('by-path')
  async getByPath(
    @Query('filePath') filePath: string,
    @Query('agentId') agentId?: string
  ) {
    return this.cinemasService.getByPath(filePath, agentId);
  }

  @Get('genre/:genre')
  async getByGenre(@Param('genre') genre: string) {
    return this.cinemasService.getByGenre(genre);
  }

  @Get(':id')
  async getById(@Param('id') id: string) {
    return this.cinemasService.getById(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createCinema(@Body() dto: CreateCinemaDto) {
    return this.cinemasService.createCinema(dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteCinema(@Param('id') id: string) {
    await this.cinemasService.deleteCinema(id);
  }
}
