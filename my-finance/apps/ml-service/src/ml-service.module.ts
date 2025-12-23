import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { MlServiceController } from './ml-service.controller';
import { CategoryPredictionService } from './categories/category-prediction.service';
import { KeywordClassifierService } from './categories/classifiers/keyword-classifier.service';
import { EnsembleClassifierService } from './categories/classifiers/ensemble-classifier.service';
import { AmountExtractorService } from './amount-extraction/amount-extractor.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    HttpModule.register({
      timeout: 5000,
      maxRedirects: 5,
    }),
  ],
  controllers: [MlServiceController],
  providers: [
    CategoryPredictionService,
    KeywordClassifierService,
    EnsembleClassifierService,
    AmountExtractorService,
  ],
  exports: [CategoryPredictionService, AmountExtractorService],
})
export class MlServiceModule {}
