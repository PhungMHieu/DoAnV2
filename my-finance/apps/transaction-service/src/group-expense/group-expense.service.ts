import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { GroupExpense } from './entities/group-expense.entity';
import { GroupExpenseShare } from './entities/group-expense-share.entity';

type SplitType = 'equal' | 'exact' | 'percent';

@Injectable()
export class GroupExpenseService {
  constructor(
    @InjectRepository(GroupExpense)
    private readonly expenseRepo: Repository<GroupExpense>,
    @InjectRepository(GroupExpenseShare)
    private readonly shareRepo: Repository<GroupExpenseShare>,
    private readonly dataSource: DataSource,
  ) {}

  // ========== PUBLIC ==========

  async createExpenseEqualSplit(params: {
    groupId: string;
    title: string;
    amount: number;
    paidByMemberId: string;
    participantMemberIds: string[];
    createdByUserId: string;
  }): Promise<GroupExpense> {
    const { groupId, title, amount, paidByMemberId, participantMemberIds, createdByUserId } = params;

    if (!participantMemberIds?.length) {
      throw new BadRequestException('participantMemberIds cannot be empty');
    }

    const centsTotal = this.toCents(amount);

    // chia đều theo cents để không lệch
    const n = participantMemberIds.length;
    const base = Math.floor(centsTotal / n);
    let remainder = centsTotal - base * n;

    const shares = participantMemberIds.map((memberId) => {
      const extra = remainder > 0 ? 1 : 0; // phân bổ phần dư
      remainder -= extra;
      return { memberId, cents: base + extra };
    });

    return this.persistExpenseWithShares({
      groupId,
      title,
      paidByMemberId,
      createdByUserId,
      splitType: 'equal',
      sharesCents: shares,
    });
  }

  /**
   * body expected:
   * {
   *   title, amount, paidByMemberId, splitType:"exact",
   *   splits:[{memberId, amount}]
   * }
   */
  async createExpenseExactSplit(groupId: string, body: any, createdByUserId: string) {
    const title = this.requireString(body?.title, 'title');
    const amount = this.requirePositiveNumber(body?.amount, 'amount');
    const paidByMemberId = this.requireString(body?.paidByMemberId, 'paidByMemberId');

    const splits = body?.splits;
    if (!Array.isArray(splits) || splits.length === 0) {
      throw new BadRequestException('splits must be non-empty array');
    }

    const sharesCents = splits.map((s: any, idx: number) => {
      const memberId = this.requireString(s?.memberId, `splits[${idx}].memberId`);
      const shareAmount = this.requireNonNegativeNumber(s?.amount, `splits[${idx}].amount`);
      return { memberId, cents: this.toCents(shareAmount) };
    });

    const sumCents = sharesCents.reduce((acc, x) => acc + x.cents, 0);
    const totalCents = this.toCents(amount);

    if (sumCents !== totalCents) {
      throw new BadRequestException(`Sum of splits (${this.fromCents(sumCents)}) must equal total amount (${amount})`);
    }

    return this.persistExpenseWithShares({
      groupId,
      title,
      paidByMemberId,
      createdByUserId,
      splitType: 'exact',
      sharesCents,
    });
  }

  /**
   * body expected:
   * {
   *   title, amount, paidByMemberId, splitType:"percent",
   *   splits:[{memberId, percent}]
   * }
   */
  async createExpensePercentSplit(groupId: string, body: any, createdByUserId: string) {
    const title = this.requireString(body?.title, 'title');
    const amount = this.requirePositiveNumber(body?.amount, 'amount');
    const paidByMemberId = this.requireString(body?.paidByMemberId, 'paidByMemberId');

    const splits = body?.splits;
    if (!Array.isArray(splits) || splits.length === 0) {
      throw new BadRequestException('splits must be non-empty array');
    }

    const totalCents = this.toCents(amount);

    // 1) validate percent
    const raw = splits.map((s: any, idx: number) => {
      const memberId = this.requireString(s?.memberId, `splits[${idx}].memberId`);
      const percent = this.requireNonNegativeNumber(s?.percent, `splits[${idx}].percent`);
      return { memberId, percent };
    });

    const percentSum = raw.reduce((acc, x) => acc + x.percent, 0);
    // cho phép sai số nhỏ do float
    if (Math.abs(percentSum - 100) > 0.0001) {
      throw new BadRequestException(`Total percent must be 100, got ${percentSum}`);
    }

    // 2) tính cents theo percent, dùng largest remainder để tổng đúng
    //    ideal = totalCents * percent / 100
    const computed = raw.map((x) => {
      const ideal = (totalCents * x.percent) / 100;
      const floor = Math.floor(ideal);
      const frac = ideal - floor;
      return { memberId: x.memberId, floor, frac };
    });

    let used = computed.reduce((acc, x) => acc + x.floor, 0);
    let remain = totalCents - used;

    // phân bổ phần dư cho các frac lớn nhất
    computed.sort((a, b) => b.frac - a.frac);

    const sharesCents = computed.map((x) => ({ memberId: x.memberId, cents: x.floor }));

    for (let i = 0; i < sharesCents.length && remain > 0; i++) {
      sharesCents[i].cents += 1;
      remain -= 1;
    }

    // restore order không quan trọng, nhưng có thể sort lại theo memberId cho ổn định
    sharesCents.sort((a, b) => a.memberId.localeCompare(b.memberId));

    const finalSum = sharesCents.reduce((acc, x) => acc + x.cents, 0);
    if (finalSum !== totalCents) {
      throw new BadRequestException('Percent split rounding failed (internal)');
    }

    return this.persistExpenseWithShares({
      groupId,
      title,
      paidByMemberId,
      createdByUserId,
      splitType: 'percent',
      sharesCents,
    });
  }

  async getExpensesOfGroup(groupId: string): Promise<GroupExpense[]> {
    return this.expenseRepo.find({
      where: { groupId },
      relations: ['shares'],
      order: { createdAt: 'DESC' },
    });
  }

  async getExpenseDetail(groupId: string, expenseId: string) {
    const exp = await this.expenseRepo.findOne({
      where: { id: expenseId, groupId },
      relations: ['shares'],
    });
    if (!exp) throw new NotFoundException('Expense not found');
    return exp;
  }

  // ========== PRIVATE HELPERS ==========

  private async persistExpenseWithShares(input: {
    groupId: string;
    title: string;
    paidByMemberId: string;
    createdByUserId: string;
    splitType: SplitType;
    sharesCents: { memberId: string; cents: number }[];
  }) {
    const { groupId, title, paidByMemberId, createdByUserId, splitType, sharesCents } = input;

    // validate memberId duplicates (tuỳ bạn muốn cho phép hay không)
    const seen = new Set<string>();
    for (const s of sharesCents) {
      if (seen.has(s.memberId)) throw new BadRequestException('Duplicate memberId in shares/splits');
      seen.add(s.memberId);
    }

    const totalCents = sharesCents.reduce((acc, s) => acc + s.cents, 0);

    return this.dataSource.transaction(async (manager) => {
      const expense = manager.create(GroupExpense, {
        groupId,
        title,
        amount: this.fromCents(totalCents), // store as string numeric
        paidByMemberId,
        createdByUserId,
        createdAt: new Date(),
        splitType,
      });

      const savedExpense = await manager.save(expense);

      const shares = sharesCents.map((s) =>
        manager.create(GroupExpenseShare, {
          expenseId: savedExpense.id,
          memberId: s.memberId,
          amount: this.fromCents(s.cents),
        }),
      );

      await manager.save(shares);
      savedExpense.shares = shares;
      return savedExpense;
    });
  }

  private toCents(value: number): number {
    // chống float: round về cents
    return Math.round(value * 100);
  }

  private fromCents(cents: number): string {
    return (cents / 100).toFixed(2);
  }

  private requireString(v: any, field: string): string {
    if (typeof v !== 'string' || !v.trim()) {
      throw new BadRequestException(`${field} is required`);
    }
    return v.trim();
  }

  private requirePositiveNumber(v: any, field: string): number {
    if (typeof v !== 'number' || !Number.isFinite(v) || v <= 0) {
      throw new BadRequestException(`${field} must be a positive number`);
    }
    return v;
  }

  private requireNonNegativeNumber(v: any, field: string): number {
    if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) {
      throw new BadRequestException(`${field} must be a non-negative number`);
    }
    return v;
  }
}
