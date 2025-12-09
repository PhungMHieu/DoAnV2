import { Module } from '@nestjs/common';
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
        entities: [AccountEntity, TransactionEntity],
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
  ],
  controllers: [TransactionServiceController, AccountController],
  providers: [TransactionServiceService, AccountService],
})
export class TransactionServiceModule {}
