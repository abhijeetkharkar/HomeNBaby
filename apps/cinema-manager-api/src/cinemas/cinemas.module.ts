import { Module } from '@nestjs/common';
import { CinemasController, ApiCinemasController } from './cinemas.controller';
import { CinemasService } from './cinemas.service';
import { MetadataModule } from '../metadata/metadata.module';

@Module({
  imports: [MetadataModule],
  controllers: [CinemasController, ApiCinemasController],
  providers: [CinemasService],
  exports: [CinemasService],
})
export class CinemasModule {}
