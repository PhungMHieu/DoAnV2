import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TransactionEntity } from './entities/transaction.entity';
import { AccountEntity } from './entities/account.entity';
import { TransactionServiceService } from './transaction-service.service';
import { RmqModule } from '@app/rmq-common/lib/rmq.module';
import { REPORT_SERVICE } from '@app/rmq-common/lib/rmq.constants';
import { HttpModule } from '@nestjs/axios';

// ML Services
import { CategoryPredictionService } from './ml/categories/category-prediction.service';
import { KeywordClassifierService } from './ml/categories/classifiers/keyword-classifier.service';
import { EnhancedKeywordClassifierService } from './ml/categories/classifiers/enhanced-keyword-classifier.service';
import { MlClassifierService } from './ml/categories/classifiers/ml-classifier.service';
import { AmountExtractorService } from './ml/amount-extraction/amount-extractor.service';
import { AccountService } from './account/account.service';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([AccountEntity, TransactionEntity]),
    RmqModule.register({
      name: REPORT_SERVICE,
      queue: 'report_queue',
    }),
    HttpModule.register({
      timeout: 10000,
      maxRedirects: 5,
    }),
  ],
  providers: [
    TransactionServiceService,
    AccountService,
    // ML Services
    CategoryPredictionService,
    KeywordClassifierService,
    EnhancedKeywordClassifierService,
    MlClassifierService,
    AmountExtractorService,
  ],
  exports: [
    TransactionServiceService,
    AccountService,
    // ML Services
    CategoryPredictionService,
    AmountExtractorService,
  ],
})
export class TransactionCoreModule {}
