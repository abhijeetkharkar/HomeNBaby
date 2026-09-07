import {
  Controller,
  Get,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Inject,
} from '@nestjs/common';
import { AgentsService } from './agents.service';
import { AgentHeartbeatDto } from '@cinema-manager/models';

@Controller('agents')
export class AgentsController {
  constructor(
    @Inject(AgentsService) private readonly agentsService: AgentsService
  ) {}

  @Get()
  async getAll() {
    return this.agentsService.getAll();
  }

  @Post('heartbeat')
  @HttpCode(HttpStatus.OK)
  async heartbeat(@Body() dto: AgentHeartbeatDto) {
    return this.agentsService.recordHeartbeat(dto);
  }
}

@Controller('api/agents')
export class ApiAgentsController {
  constructor(
    @Inject(AgentsService) private readonly agentsService: AgentsService
  ) {}

  @Get()
  async getAll() {
    return this.agentsService.getAll();
  }

  @Post('heartbeat')
  @HttpCode(HttpStatus.OK)
  async heartbeat(@Body() dto: AgentHeartbeatDto) {
    return this.agentsService.recordHeartbeat(dto);
  }
}
