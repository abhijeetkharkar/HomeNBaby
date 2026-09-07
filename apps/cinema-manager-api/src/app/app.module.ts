import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DynamoDbModule } from '../dynamodb/dynamodb.module';
import { MetadataModule } from '../metadata/metadata.module';
import { CinemasModule } from '../cinemas/cinemas.module';
import { LookupPathsModule } from '../lookup-paths/lookup-paths.module';
import { AgentsModule } from '../agents/agents.module';

@Module({
  imports: [
    DynamoDbModule,
    MetadataModule,
    CinemasModule,
    LookupPathsModule,
    AgentsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
