import { Module } from '@nestjs/common';
import { TrainingDataService } from './training-data.service';
import { TrainingDataController } from './training-data.controller';

@Module({
  controllers: [TrainingDataController],
  providers: [TrainingDataService],
  exports: [TrainingDataService],
})
export class TrainingDataModule {}
