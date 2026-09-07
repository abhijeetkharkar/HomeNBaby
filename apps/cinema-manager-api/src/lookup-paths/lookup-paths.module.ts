import { Module } from '@nestjs/common';
import {
  LookupPathsController,
  ApiLookupPathsController,
} from './lookup-paths.controller';
import { LookupPathsService } from './lookup-paths.service';

@Module({
  controllers: [LookupPathsController, ApiLookupPathsController],
  providers: [LookupPathsService],
  exports: [LookupPathsService],
})
export class LookupPathsModule {}
