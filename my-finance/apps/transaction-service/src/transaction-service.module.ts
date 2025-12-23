import { MiddlewareConsumer, Module, NestModule, forwardRef } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TransactionServiceController } from './transaction-service.controller';
import { TransactionServiceService } from './transaction-service.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TransactionEntity } from './entities/transaction.entity';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { RmqModule } from '@app/rmq-common/lib/rmq.module';
import { REPORT_SERVICE } from '@app/rmq-common/lib/rmq.constants';
import { AuthCommonModule } from '@app/auth-common/auth-common.module';
import { AccountEntity } from './entities/account.entity';
import { AccountController } from './account.controller';
import { AccountService } from './account.service';
import { JwtExtractMiddleware } from '@app/common';
import { HttpModule } from '@nestjs/axios';
import { MlClientService } from './ml-client/ml-client.service';
import { GroupExpenseModule } from './group-expense/group-expense.module';
import { GroupExpense } from './group-expense/entities/group-expense.entity';
import { GroupExpenseShare } from './group-expense/entities/group-expense-share.entity';


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
        entities: [AccountEntity, TransactionEntity, GroupExpense, GroupExpenseShare],
        synchronize: config.get<string>('NODE_ENV') !== 'production',
        logging: config.get<string>('NODE_ENV') === 'development',
      }),
    }),
    TypeOrmModule.forFeature([AccountEntity, TransactionEntity]),
    RmqModule.register({
      name: REPORT_SERVICE,
      queue: 'report_queue',
    }),
    AuthCommonModule,
    HttpModule.register({
      timeout: 5000,
      maxRedirects: 5,
    }),
    forwardRef(() => GroupExpenseModule),
  ],
  controllers: [TransactionServiceController, AccountController],
  providers: [TransactionServiceService, AccountService, MlClientService],
  exports: [TransactionServiceService], // Export for GroupExpenseModule
})
export class TransactionServiceModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(JwtExtractMiddleware).forRoutes('*');
  }
}
