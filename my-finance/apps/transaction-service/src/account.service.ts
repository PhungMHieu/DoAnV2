import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { AccountEntity } from './entities/account.entity';
import { Repository } from 'typeorm';

@Injectable()
export class AccountService {
  constructor(
    @InjectRepository(AccountEntity)
    private accountRepo: Repository<AccountEntity>,
  ) {}

  async getBalance(userId: string) {
    const account = await this.accountRepo.findOne({ where: { userId } });

    if (!account) {
      return { balance: 0 };
    }

    return { balance: account.balance };
  }
}
