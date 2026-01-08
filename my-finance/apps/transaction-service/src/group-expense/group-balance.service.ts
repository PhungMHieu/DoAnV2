import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GroupExpense } from './entities/group-expense.entity';

/**
 * net > 0  : member này được nhận tiền
 * net < 0  : member này đang nợ tiền
 */
export interface NetRecord {
  memberId: string;
  net: number;
}

/**
 * fromMemberId -> toMemberId : amount
 */
export interface BalanceRecord {
  fromMemberId: string;
  toMemberId: string;
  amount: number;
}

@Injectable()
export class GroupBalanceService {
  constructor(
    @InjectRepository(GroupExpense)
    private readonly expenseRepo: Repository<GroupExpense>,
  ) {}

  /**
   * Tính net cho từng member trong group
   */
  async getNetPerMember(groupId: string): Promise<NetRecord[]> {
    const expenses = await this.expenseRepo.find({
      where: { groupId },
      relations: ['shares', 'transactions'],
    });

    const netMap = new Map<string, number>();

    for (const exp of expenses) {
      const total = exp.totalAmount;

      // Người trả tiền chi toàn bộ
      netMap.set(
        exp.paidByMemberId,
        (netMap.get(exp.paidByMemberId) ?? 0) + total,
      );

      // Mỗi share là phần phải chịu
      for (const share of exp.shares) {
        const shareAmount = Number(share.amount);
        netMap.set(
          share.memberId,
          (netMap.get(share.memberId) ?? 0) - shareAmount,
        );
      }
    }

    return Array.from(netMap.entries()).map(([memberId, net]) => ({
      memberId,
      net: Number(net.toFixed(2)),
    }));
  }

  /**
   * Rút gọn nợ (giống Splitwise)
   * Input: net list
   * Output: danh sách from -> to -> amount
   */
  simplify(netList: NetRecord[]): BalanceRecord[] {
    const creditors = netList.filter((m) => m.net > 0).map((m) => ({ ...m }));
    const debtors = netList.filter((m) => m.net < 0).map((m) => ({ ...m }));

    const result: BalanceRecord[] = [];

    let i = 0;
    let j = 0;

    while (i < debtors.length && j < creditors.length) {
      const debtor = debtors[i];
      const creditor = creditors[j];

      const debt = -debtor.net;
      const credit = creditor.net;

      const amount = Math.min(debt, credit);

      if (amount > 0.009) {
        result.push({
          fromMemberId: debtor.memberId,
          toMemberId: creditor.memberId,
          amount: Number(amount.toFixed(2)),
        });

        debtor.net += amount;
        creditor.net -= amount;
      }

      if (Math.abs(debtor.net) < 0.009) i++;
      if (Math.abs(creditor.net) < 0.009) j++;
    }

    return result;
  }

  /**
   * API dùng trực tiếp: vừa net, vừa simplified
   */
  async getSimplifiedBalances(groupId: string) {
    const netList = await this.getNetPerMember(groupId);
    const simplified = this.simplify(netList);

    return {
      netList,
      simplified,
    };
  }
}
