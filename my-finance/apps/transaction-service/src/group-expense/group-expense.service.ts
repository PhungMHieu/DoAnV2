import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { GroupExpense } from './entities/group-expense.entity';
import { GroupExpenseShare } from './entities/group-expense-share.entity';
import { TransactionServiceService } from '../transaction-service.service';
import { GroupClientService } from './group-client.service';

type SplitType = 'equal' | 'exact' | 'percent';

@Injectable()
export class GroupExpenseService {
  constructor(
    @InjectRepository(GroupExpense)
    private readonly expenseRepo: Repository<GroupExpense>,
    @InjectRepository(GroupExpenseShare)
    private readonly shareRepo: Repository<GroupExpenseShare>,
    private readonly dataSource: DataSource,
    private readonly transactionServiceService: TransactionServiceService,
    private readonly groupClientService: GroupClientService,
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

  /**
   * Get all debts for a specific member in a group
   * Returns expenses where this member owes money (share amount > 0 AND member didn't pay)
   */
  async getMyDebts(groupId: string, memberId: string) {
    // Find all shares for this member in this group's expenses
    const shares = await this.shareRepo.find({
      where: { memberId },
      relations: ['expense'],
    });

    // Filter to only expenses in this group where member owes money
    const debts = shares
      .filter((share) => {
        const expense = share.expense;
        // Must be in the specified group
        if (expense.groupId !== groupId) return false;
        // Member owes if they have a share AND they are not the payer
        if (expense.paidByMemberId === memberId) return false;
        // Filter out paid shares
        if (share.isPaid) return false;
        return true;
      })
      .map((share) => ({
        shareId: share.id, // Add shareId for mark-paid
        expenseId: share.expenseId,
        expenseTitle: share.expense.title,
        totalAmount: share.expense.amount,
        myShare: share.amount,
        paidByMemberId: share.expense.paidByMemberId,
        createdAt: share.expense.createdAt,
        splitType: share.expense.splitType,
        isPaid: share.isPaid, // Include status
      }));

    return debts;
  }

  /**
   * Mark a share as paid and create settlement transactions for both parties
   * Only the payer can mark shares as paid
   */
  async markShareAsPaid(shareId: string, currentMemberId: number, groupId: string) {
    return this.dataSource.transaction(async (manager) => {
      const shareRepo = manager.getRepository(GroupExpenseShare);

      // 1. Find the share with expense relation
      const share = await shareRepo.findOne({
        where: { id: shareId },
        relations: ['expense', 'expense.shares'],
      });

      if (!share) throw new NotFoundException('Share not found');
      if (share.isPaid) throw new BadRequestException('Already paid');

      const expense = share.expense;

      // Verify share belongs to this group
      if (expense.groupId !== groupId) {
        throw new BadRequestException('Share does not belong to this group');
      }

      // 2. Verify current user is the PAYER (only payer can mark as paid)
      if (expense.paidByMemberId !== String(currentMemberId)) {
        throw new ForbiddenException('Only the payer can mark debts as paid');
      }

      // 3. Check if both parties have userId set
      if (!share.userId) {
        throw new BadRequestException('Debtor has not joined the group yet');
      }

      // Get payer's userId from shares (payer has a share too)
      const payerShare = expense.shares.find(
        (s) => s.memberId === expense.paidByMemberId
      );
      if (!payerShare?.userId) {
        throw new BadRequestException('Payer userId not found');
      }

      const debtorUserId = share.userId;
      const payerUserId = payerShare.userId;

      // 4. Update share status
      share.isPaid = true;
      share.paidAt = new Date();
      await shareRepo.save(share);

      // 5. Create transaction for DEBTOR (expense)
      const debtorTx = await this.transactionServiceService.createTransaction(
        debtorUserId,
        {
          amount: parseFloat(share.amount),
          category: 'Group Settlement',
          note: `Paid for: ${expense.title}`,
          dateTime: new Date(),
        } as any,
      );

      // 6. Create transaction for PAYER (income)
      const payerTx = await this.transactionServiceService.createTransaction(
        payerUserId,
        {
          amount: parseFloat(share.amount),
          category: 'Income',
          note: `Received payment for: ${expense.title}`,
          dateTime: new Date(),
        } as any,
      );

      return {
        shareId: share.id,
        isPaid: share.isPaid,
        paidAt: share.paidAt,
        debtorTransactionId: debtorTx.id,
        payerTransactionId: payerTx.id,
      };
    });
  }

  /**
   * Get all debts owed to current member (who owes me money)
   */
  async getOwedToMe(groupId: string, memberId: string) {
    // Find all expenses in this group where current user is the payer
    const expenses = await this.expenseRepo.find({
      where: {
        groupId,
        paidByMemberId: memberId,
      },
      relations: ['shares'],
    });

    // Collect unpaid shares from other members
    const debts: any[] = [];

    for (const expense of expenses) {
      const unpaidShares = expense.shares.filter(
        (share) =>
          share.memberId !== memberId && // Not self
          !share.isPaid // Not paid yet
      );

      for (const share of unpaidShares) {
        debts.push({
          shareId: share.id,
          expenseId: expense.id,
          expenseTitle: expense.title,
          totalAmount: expense.amount,
          shareAmount: share.amount,
          debtorMemberId: share.memberId,
          createdAt: expense.createdAt,
          isPaid: share.isPaid,
        });
      }
    }

    return debts;
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

      // Fetch userId for each memberId and create shares
      const shares = await Promise.all(
        sharesCents.map(async (s) => {
          // Fetch userId for this memberId
          let memberUserId: string | null = null;
          try {
            memberUserId = await this.groupClientService.getUserIdFromMemberId(
              groupId,
              parseInt(s.memberId)
            );
          } catch (error) {
            // Member hasn't joined yet, userId will be null
            console.warn(`Member ${s.memberId} has not joined yet`);
          }

          return manager.create(GroupExpenseShare, {
            expenseId: savedExpense.id,
            memberId: s.memberId,
            amount: this.fromCents(s.cents),
            userId: memberUserId,
            isPaid: s.memberId === paidByMemberId, // Auto-mark payer's share as paid
          });
        })
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
