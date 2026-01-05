import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { MlServiceController } from './ml-service.controller';
import { CategoryPredictionService } from './categories/category-prediction.service';
import { KeywordClassifierService } from './categories/classifiers/keyword-classifier.service';
import { EnhancedKeywordClassifierService } from './categories/classifiers/enhanced-keyword-classifier.service';
import { EnsembleClassifierService } from './categories/classifiers/ensemble-classifier.service';
import { AmountExtractorService } from './amount-extraction/amount-extractor.service';
import { TrainingDataModule } from './training-data/training-data.module';

// Note: gRPC module disabled - Python ML service not available yet
// Will use keyword-based classification only

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    HttpModule,
    TrainingDataModule,
  ],
  controllers: [MlServiceController],
  providers: [
    CategoryPredictionService,
    KeywordClassifierService,
    EnhancedKeywordClassifierService,
    EnsembleClassifierService,
    AmountExtractorService,
  ],
  exports: [CategoryPredictionService, AmountExtractorService],
})
export class MlServiceModule {}
