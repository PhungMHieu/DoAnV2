import { Module } from '@nestjs/common';
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
