import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { GroupExpense } from './entities/group-expense.entity';
import { GroupExpenseShare } from './entities/group-expense-share.entity';
import { GroupExpenseService } from './group-expense.service';
import { GroupExpenseController } from './group-expense.controller';
import { GroupBalanceController } from './group-balance.controller';
import { GroupBalanceService } from './group-balance.service';
import { GroupClientService } from './group-client.service';
import { TransactionServiceModule } from '../transaction-service.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([GroupExpense, GroupExpenseShare]),
    HttpModule.register({
      timeout: 5000,
      maxRedirects: 5,
    }),
    forwardRef(() => TransactionServiceModule), // Import parent module to access TransactionServiceService
  ],
  providers: [GroupExpenseService, GroupBalanceService, GroupClientService],
  controllers: [GroupExpenseController, GroupBalanceController],
  exports: [GroupExpenseService, GroupBalanceService],
})
export class GroupExpenseModule {}
