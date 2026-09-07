import { Injectable, Logger, Inject } from '@nestjs/common';
import { DynamoDbService } from '../dynamodb/dynamodb.service';
import { CinemaAgent, AgentHeartbeatDto } from '@cinema-manager/models';

@Injectable()
export class AgentsService {
  private readonly logger = new Logger(AgentsService.name);

  constructor(
    @Inject(DynamoDbService) private readonly dynamoDbService: DynamoDbService
  ) {}

  async getAll(): Promise<CinemaAgent[]> {
    this.logger.log('Fetching registered agents');
    return this.dynamoDbService.scan<CinemaAgent>(
      this.dynamoDbService.agentsTable
    );
  }

  async recordHeartbeat(dto: AgentHeartbeatDto): Promise<CinemaAgent> {
    const agent: CinemaAgent = {
      agentId: dto.agentId,
      agentName: dto.agentName || `Agent-${dto.agentId.substring(0, 6)}`,
      hostname: dto.hostname || '',
      version: dto.version || '1.0.0',
      lastHeartbeat: new Date().toISOString(),
      status: dto.status || 'online',
      watchPaths: dto.watchPaths || [],
    };

    await this.dynamoDbService.putItem(
      this.dynamoDbService.agentsTable,
      agent
    );

    this.logger.log(`Heartbeat recorded for agent ${agent.agentId} (${agent.agentName})`);
    return agent;
  }
}
