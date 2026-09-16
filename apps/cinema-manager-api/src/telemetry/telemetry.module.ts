import { Module } from '@nestjs/common';
import { TelemetryService } from './telemetry.service';
import { TelemetryController } from './telemetry.controller';
import { DynamoDbModule } from '../dynamodb/dynamodb.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [DynamoDbModule, AuthModule],
  controllers: [TelemetryController],
  providers: [TelemetryService],
  exports: [TelemetryService],
})
export class TelemetryModule {}
