import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { TelemetryModule } from '../telemetry/telemetry.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [TelemetryModule, AuthModule],
  controllers: [AdminController],
})
export class AdminModule {}
