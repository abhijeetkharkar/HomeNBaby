import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  Inject,
} from '@nestjs/common';
import { LookupPathsService } from './lookup-paths.service';

@Controller('lookup-paths')
export class LookupPathsController {
  constructor(
    @Inject(LookupPathsService)
    private readonly lookupPathsService: LookupPathsService
  ) {}

  @Get()
  async getAll() {
    return this.lookupPathsService.getAll();
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async addPath(@Body() body: { path: string; agentId?: string }) {
    return this.lookupPathsService.addPath(body.path, body.agentId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deletePath(@Param('id') id: string) {
    await this.lookupPathsService.deletePath(id);
  }
}

@Controller('api/lookup-paths')
export class ApiLookupPathsController {
  constructor(
    @Inject(LookupPathsService)
    private readonly lookupPathsService: LookupPathsService
  ) {}

  @Get()
  async getAll() {
    return this.lookupPathsService.getAll();
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async addPath(@Body() body: { path: string; agentId?: string }) {
    return this.lookupPathsService.addPath(body.path, body.agentId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deletePath(@Param('id') id: string) {
    await this.lookupPathsService.deletePath(id);
  }
}
