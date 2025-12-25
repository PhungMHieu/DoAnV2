import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { AccountEntity } from './entities/account.entity';
import { TransactionEntity } from './entities/transaction.entity';
import { Repository, DataSource } from 'typeorm';

@Injectable()
export class AccountService {
  private readonly logger = new Logger(AccountService.name);

  constructor(
    @InjectRepository(AccountEntity)
    private accountRepo: Repository<AccountEntity>,
    private dataSource: DataSource,
  ) {}

  async getBalance(userId: string) {
    const account = await this.accountRepo.findOne({ where: { userId } });

    if (!account) {
      return { balance: 0 };
    }

    return { balance: account.balance };
  }

  /**
   * Admin endpoint: Recalculate account balance from all transactions
   * Use this to fix desync between account balance and transaction history
   */
  async recalculateBalance(userId: string) {
    return this.dataSource.transaction(async (manager) => {
      const accountRepo = manager.getRepository(AccountEntity);
      const txRepo = manager.getRepository(TransactionEntity);

      // Get or create account
      let account = await accountRepo.findOne({ where: { userId } });
      if (!account) {
        account = accountRepo.create({ userId, balance: 0 });
        await accountRepo.save(account);
      }

      // Calculate correct balance from all transactions
      const transactions = await txRepo.find({ where: { userId } });

      let calculatedBalance = 0;
      for (const tx of transactions) {
        const amount = parseFloat(String(tx.amount));
        if (tx.category.toLowerCase() === 'income') {
          calculatedBalance += amount;
        } else {
          calculatedBalance -= amount;
        }
      }

      const oldBalance = account.balance;

      // Update account balance
      account.balance = calculatedBalance;
      await accountRepo.save(account);

      this.logger.log(`✅ Recalculated balance for user ${userId}: ${oldBalance} → ${calculatedBalance}`);

      return {
        userId,
        oldBalance,
        newBalance: calculatedBalance,
        difference: calculatedBalance - oldBalance,
        transactionsProcessed: transactions.length,
      };
    });
  }
}
