import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { join } from 'path';
import { TransactionEntity } from './entities/transaction.entity';
import { AccountEntity } from './entities/account.entity';
import { TransactionServiceService } from './transaction-service.service';
import { RmqModule } from '@app/rmq-common/lib/rmq.module';
import { REPORT_SERVICE } from '@app/rmq-common/lib/rmq.constants';

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
    // ML gRPC Client
    ClientsModule.registerAsync([
      {
        name: 'ML_GRPC_PACKAGE',
        imports: [ConfigModule],
        useFactory: (configService: ConfigService) => {
          const grpcUrl =
            configService.get<string>('ML_GRPC_URL') || 'localhost:50051';

          // In Docker: /app/proto/ml_service.proto
          // In local dev: relative path from dist
          const protoPath = join(process.cwd(), 'proto/ml_service.proto');

          return {
            transport: Transport.GRPC,
            options: {
              package: 'ml',
              protoPath,
              url: grpcUrl,
            },
          };
        },
        inject: [ConfigService],
      },
    ]),
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
