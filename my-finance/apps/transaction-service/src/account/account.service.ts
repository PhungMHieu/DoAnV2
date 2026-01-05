import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { AccountEntity } from '../entities/account.entity';
import { TransactionEntity } from '../entities/transaction.entity';
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
}
