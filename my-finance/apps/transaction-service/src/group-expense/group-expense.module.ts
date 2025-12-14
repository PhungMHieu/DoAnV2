import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GroupExpense } from './entities/group-expense.entity';
import { GroupExpenseShare } from './entities/group-expense-share.entity';
import { GroupExpenseService } from './group-expense.service';
import { GroupExpenseController } from './group-expense.controller';
import { GroupBalanceController } from './group-balance.controller';
import { GroupBalanceService } from './group-balance.service';

@Module({
  imports: [TypeOrmModule.forFeature([GroupExpense, GroupExpenseShare])],
  providers: [GroupExpenseService, GroupBalanceService],
  controllers: [GroupExpenseController, GroupBalanceController],
  exports: [GroupExpenseService, GroupBalanceService],
})
export class GroupExpenseModule {}
