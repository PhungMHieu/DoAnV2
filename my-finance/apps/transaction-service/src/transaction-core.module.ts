import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TransactionEntity } from './entities/transaction.entity';
import { AccountEntity } from './entities/account.entity';
import { TransactionServiceService } from './transaction-service.service';
import { AccountService } from './account.service';
import { RmqModule } from '@app/rmq-common/lib/rmq.module';
import { REPORT_SERVICE } from '@app/rmq-common/lib/rmq.constants';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([AccountEntity, TransactionEntity]),
    RmqModule.register({
      name: REPORT_SERVICE,
      queue: 'report_queue',
    }),
  ],
  providers: [TransactionServiceService, AccountService],
  exports: [TransactionServiceService, AccountService],
})
export class TransactionCoreModule {}
