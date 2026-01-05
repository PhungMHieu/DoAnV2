import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TransactionServiceController } from './transaction-service.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthCommonModule } from '@app/auth-common/auth-common.module';
import { JwtExtractMiddleware } from '@app/common';
import { HttpModule } from '@nestjs/axios';
import { GroupExpense } from './group-expense/entities/group-expense.entity';
import { GroupExpenseShare } from './group-expense/entities/group-expense-share.entity';
import { GroupExpenseModule } from './group-expense/group-expense.module';
import { TransactionCoreModule } from './transaction-core.module';
import { AccountEntity } from './entities/account.entity';
import { TransactionEntity } from './entities/transaction.entity';
import { GrpcModule } from './grpc/grpc.module';
import { AccountModule } from './account/account.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.get<string>('DATABASE_URL'),
        entities: [
          AccountEntity,
          TransactionEntity,
          GroupExpense,
          GroupExpenseShare,
        ],
        synchronize: config.get<string>('NODE_ENV') !== 'production',
        logging: config.get<string>('NODE_ENV') === 'development',
      }),
    }),
    AuthCommonModule,
    HttpModule.register({
      timeout: 5000,
      maxRedirects: 5,
    }),
    TransactionCoreModule,
    GroupExpenseModule,
    GrpcModule,
    AccountModule,
  ],
  controllers: [TransactionServiceController],
})
export class TransactionServiceModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(JwtExtractMiddleware).forRoutes('*');
  }
}
