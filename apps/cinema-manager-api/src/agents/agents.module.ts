import { Module } from '@nestjs/common';
import { AgentsController, ApiAgentsController } from './agents.controller';
import { AgentsService } from './agents.service';

@Module({
  controllers: [AgentsController, ApiAgentsController],
  providers: [AgentsService],
  exports: [AgentsService],
})
export class AgentsModule {}
