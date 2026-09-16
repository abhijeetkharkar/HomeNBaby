import { Module } from '@nestjs/common';
import { MetadataService } from './metadata.service';
import { TelemetryModule } from '../telemetry/telemetry.module';

@Module({
  imports: [TelemetryModule],
  providers: [MetadataService],
  exports: [MetadataService],
})
export class MetadataModule {}
