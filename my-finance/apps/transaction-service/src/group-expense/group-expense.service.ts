import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository, Between } from 'typeorm';
import { GroupExpense } from './entities/group-expense.entity';
import { GroupExpenseShare } from './entities/group-expense-share.entity';
import { TransactionServiceService } from '../transaction-service.service';
import { GroupClientService } from './group-client.service';
import {
  PaymentHistoryItem,
  PaymentHistoryResponse,
  DebtItem,
  OwedToMeItem,
} from './dto';

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
    paidByUserId: string;
    participants: { memberId: string; userId: string }[];
    createdByUserId: string;
    category?: string;
  }): Promise<GroupExpense> {
    const {
      groupId,
      title,
      amount,
      paidByMemberId,
      paidByUserId,
      participants,
      createdByUserId,
      category,
    } = params;

    if (!participants?.length) {
      throw new BadRequestException('participants cannot be empty');
    }

    const centsTotal = this.toCents(amount);

    // chia đều theo cents để không lệch
    const n = participants.length;
    const base = Math.floor(centsTotal / n);
    let remainder = centsTotal - base * n;

    const shares = participants.map((p) => {
      const extra = remainder > 0 ? 1 : 0; // phân bổ phần dư
      remainder -= extra;
      return { memberId: p.memberId, userId: p.userId, cents: base + extra };
    });

    return this.persistExpenseWithShares({
      groupId,
      title,
      paidByMemberId,
      paidByUserId,
      createdByUserId,
      splitType: 'equal',
      sharesCents: shares,
      category,
    });
  }

  /**
   * body expected:
   * {
   *   title, amount, paidByMemberId, paidByUserId, splitType:"exact",
   *   exactSplits:[{memberId, userId, amount}]
   * }
   */
  async createExpenseExactSplit(
    groupId: string,
    body: any,
    createdByUserId: string,
  ) {
    const title = this.requireString(body?.title, 'title');
    const amount = this.requirePositiveNumber(body?.amount, 'amount');
    const paidByMemberId = this.requireString(
      body?.paidByMemberId,
      'paidByMemberId',
    );
    const paidByUserId = this.requireString(body?.paidByUserId, 'paidByUserId');
    const category = body?.category;

    const splits = body?.exactSplits;
    if (!Array.isArray(splits) || splits.length === 0) {
      throw new BadRequestException('exactSplits must be non-empty array');
    }

    const sharesCents = splits.map((s: any, idx: number) => {
      const memberId = this.requireString(
        s?.memberId,
        `exactSplits[${idx}].memberId`,
      );
      const userId = this.requireString(
        s?.userId,
        `exactSplits[${idx}].userId`,
      );
      const shareAmount = this.requireNonNegativeNumber(
        s?.amount,
        `exactSplits[${idx}].amount`,
      );
      return { memberId, userId, cents: this.toCents(shareAmount) };
    });

    const sumCents = sharesCents.reduce((acc, x) => acc + x.cents, 0);
    const totalCents = this.toCents(amount);

    if (sumCents !== totalCents) {
      throw new BadRequestException(
        `Sum of splits (${this.fromCents(sumCents)}) must equal total amount (${amount})`,
      );
    }

    return this.persistExpenseWithShares({
      groupId,
      title,
      paidByMemberId,
      paidByUserId,
      createdByUserId,
      splitType: 'exact',
      sharesCents,
      category,
    });
  }

  /**
   * body expected:
   * {
   *   title, amount, paidByMemberId, paidByUserId, splitType:"percent",
   *   percentSplits:[{memberId, userId, percent}]
   * }
   */
  async createExpensePercentSplit(
    groupId: string,
    body: any,
    createdByUserId: string,
  ) {
    const title = this.requireString(body?.title, 'title');
    const amount = this.requirePositiveNumber(body?.amount, 'amount');
    const paidByMemberId = this.requireString(
      body?.paidByMemberId,
      'paidByMemberId',
    );
    const paidByUserId = this.requireString(body?.paidByUserId, 'paidByUserId');
    const category = body?.category;

    const splits = body?.percentSplits;
    if (!Array.isArray(splits) || splits.length === 0) {
      throw new BadRequestException('percentSplits must be non-empty array');
    }

    const totalCents = this.toCents(amount);

    // 1) validate percent
    const raw = splits.map((s: any, idx: number) => {
      const memberId = this.requireString(
        s?.memberId,
        `percentSplits[${idx}].memberId`,
      );
      const userId = this.requireString(
        s?.userId,
        `percentSplits[${idx}].userId`,
      );
      const percent = this.requireNonNegativeNumber(
        s?.percent,
        `percentSplits[${idx}].percent`,
      );
      return { memberId, userId, percent };
    });

    const percentSum = raw.reduce((acc, x) => acc + x.percent, 0);
    if (Math.abs(percentSum - 100) > 0.0001) {
      throw new BadRequestException(
        `Total percent must be 100, got ${percentSum}`,
      );
    }

    // 2) tính cents theo percent, dùng largest remainder để tổng đúng
    const computed = raw.map((x) => {
      const ideal = (totalCents * x.percent) / 100;
      const floor = Math.floor(ideal);
      const frac = ideal - floor;
      return { memberId: x.memberId, userId: x.userId, floor, frac };
    });

    const used = computed.reduce((acc, x) => acc + x.floor, 0);
    let remain = totalCents - used;

    // phân bổ phần dư cho các frac lớn nhất
    computed.sort((a, b) => b.frac - a.frac);

    const sharesCents = computed.map((x) => ({
      memberId: x.memberId,
      userId: x.userId,
      cents: x.floor,
    }));

    for (let i = 0; i < sharesCents.length && remain > 0; i++) {
      sharesCents[i].cents += 1;
      remain -= 1;
    }

    sharesCents.sort((a, b) => a.memberId.localeCompare(b.memberId));

    const finalSum = sharesCents.reduce((acc, x) => acc + x.cents, 0);
    if (finalSum !== totalCents) {
      throw new BadRequestException('Percent split rounding failed (internal)');
    }

    return this.persistExpenseWithShares({
      groupId,
      title,
      paidByMemberId,
      paidByUserId,
      createdByUserId,
      splitType: 'percent',
      sharesCents,
      category,
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
  async getMyDebts(groupId: string, memberId: string): Promise<DebtItem[]> {
    const shares = await this.shareRepo.find({
      where: { memberId },
      relations: ['expense'],
    });

    return shares
      .filter((share) => {
        const expense = share.expense;
        if (expense.groupId !== groupId) return false;
        if (expense.paidByMemberId === memberId) return false;
        if (share.isPaid) return false;
        return true;
      })
      .map((share): DebtItem => ({
        shareId: share.id,
        expenseId: share.expenseId,
        expenseTitle: share.expense.title,
        totalAmount: share.expense.amount,
        myShare: share.amount,
        paidByMemberId: share.expense.paidByMemberId,
        createdAt: share.expense.createdAt,
        splitType: share.expense.splitType,
        isPaid: share.isPaid,
      }));
  }

  /**
   * Mark a share as paid and create settlement transactions for both parties
   * Only the payer can mark shares as paid
   */
  async markShareAsPaid(
    shareId: string,
    currentMemberId: number,
    groupId: string,
  ) {
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
        (s) => s.memberId === expense.paidByMemberId,
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
      // Use expense's category if available, fallback to 'Group Settlement'
      const debtorTx = await this.transactionServiceService.createTransaction(
        debtorUserId,
        {
          amount: parseFloat(share.amount),
          category: expense.category || 'Group Settlement',
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
  async getOwedToMe(groupId: string, memberId: string): Promise<OwedToMeItem[]> {
    const expenses = await this.expenseRepo.find({
      where: {
        groupId,
        paidByMemberId: memberId,
      },
      relations: ['shares'],
    });

    const debts: OwedToMeItem[] = [];

    for (const expense of expenses) {
      const unpaidShares = expense.shares.filter(
        (share) => share.memberId !== memberId && !share.isPaid,
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

  /**
   * Get payment history (paid/received) for a member in a month
   */
  async getPaymentHistory(
    groupId: string,
    memberId: string,
    monthYear: string,
  ): Promise<PaymentHistoryResponse> {
    const [monthStr, yearStr] = monthYear.split('/');
    const month = parseInt(monthStr);
    const year = parseInt(yearStr);

    if (!month || !year || month < 1 || month > 12) {
      throw new BadRequestException('monthYear must be in format MM/YYYY');
    }

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59, 999);

    const expenses = await this.expenseRepo.find({
      where: {
        groupId,
        createdAt: Between(startDate, endDate),
      },
      relations: ['shares'],
      order: { createdAt: 'DESC' },
    });

    const payments: PaymentHistoryItem[] = [];
    let totalPaid = 0;
    let totalReceived = 0;

    for (const expense of expenses) {
      // A. Current user is the PAYER
      if (expense.paidByMemberId === memberId) {
        payments.push({
          date: expense.createdAt,
          type: 'paid',
          amount: parseFloat(expense.amount),
          expenseId: expense.id,
          expenseTitle: expense.title,
          category: expense.category || 'Group Expense',
          note: 'Đã thanh toán cho nhóm',
        });
        totalPaid += parseFloat(expense.amount);
      }

      // B. Current user RECEIVED payment
      if (expense.paidByMemberId === memberId) {
        const paidShares = expense.shares.filter(
          (s) => s.memberId !== memberId && s.isPaid,
        );

        for (const share of paidShares) {
          let memberName = `Member ${share.memberId}`;
          try {
            const member = await this.groupClientService.getMemberById(
              groupId,
              parseInt(share.memberId),
            );
            memberName = member.name || memberName;
          } catch {
            // Ignore error
          }

          payments.push({
            date: share.paidAt || expense.createdAt,
            type: 'received',
            amount: parseFloat(share.amount),
            expenseId: expense.id,
            expenseTitle: expense.title,
            category: expense.category || 'Group Expense',
            from: memberName,
            fromMemberId: share.memberId,
            note: `Nhận từ ${memberName}`,
          });
          totalReceived += parseFloat(share.amount);
        }
      }

      // C. Current user is DEBTOR and has paid
      const myShare = expense.shares.find(
        (s) =>
          s.memberId === memberId &&
          s.isPaid &&
          expense.paidByMemberId !== memberId,
      );

      if (myShare) {
        let payerName = `Member ${expense.paidByMemberId}`;
        try {
          const payer = await this.groupClientService.getMemberById(
            groupId,
            parseInt(expense.paidByMemberId),
          );
          payerName = payer.name || payerName;
        } catch {
          // Ignore error
        }

        payments.push({
          date: myShare.paidAt || expense.createdAt,
          type: 'paid',
          amount: parseFloat(myShare.amount),
          expenseId: expense.id,
          expenseTitle: expense.title,
          category: expense.category || 'Group Expense',
          to: payerName,
          toMemberId: expense.paidByMemberId,
          note: `Đã trả cho ${payerName}`,
        });
        totalPaid += parseFloat(myShare.amount);
      }
    }

    payments.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );

    return {
      month: monthYear,
      payments,
      summary: {
        totalPaid,
        totalReceived,
        net: totalReceived - totalPaid,
      },
    };
  }

  // ========== PRIVATE HELPERS ==========

  private async persistExpenseWithShares(input: {
    groupId: string;
    title: string;
    paidByMemberId: string;
    paidByUserId: string;
    createdByUserId: string;
    splitType: SplitType;
    sharesCents: { memberId: string; userId: string; cents: number }[];
    category?: string;
  }) {
    const {
      groupId,
      title,
      paidByMemberId,
      paidByUserId,
      createdByUserId,
      splitType,
      sharesCents,
      category,
    } = input;

    // validate memberId duplicates
    const seen = new Set<string>();
    for (const s of sharesCents) {
      if (seen.has(s.memberId))
        throw new BadRequestException('Duplicate memberId in shares/splits');
      seen.add(s.memberId);
    }

    const totalCents = sharesCents.reduce((acc, s) => acc + s.cents, 0);

    return this.dataSource.transaction(async (manager) => {
      const expense = manager.create(GroupExpense, {
        groupId,
        title,
        amount: this.fromCents(totalCents),
        paidByMemberId,
        createdByUserId,
        createdAt: new Date(),
        splitType,
        category,
      });

      const savedExpense = await manager.save(expense);

      // Tạo shares với userId từ request (không cần lookup)
      const shares = sharesCents.map((s) =>
        manager.create(GroupExpenseShare, {
          expenseId: savedExpense.id,
          memberId: s.memberId,
          amount: this.fromCents(s.cents),
          userId: s.userId,
          isPaid: s.memberId === paidByMemberId,
        }),
      );

      await manager.save(shares);
      savedExpense.shares = shares;

      // Tạo transaction cho người trả tiền
      if (paidByUserId) {
        try {
          const payerAmount = Math.abs(parseFloat(this.fromCents(totalCents)));
          await this.transactionServiceService.createTransaction(
            paidByUserId,
            {
              amount: payerAmount,
              category: category || 'Group Expense',
              note: `Paid for group: ${title}`,
              dateTime: new Date(),
            } as any,
          );
          console.log(
            `[Expense Creation] ✅ Created transaction for payer ${paidByUserId} with amount ${payerAmount}`,
          );
        } catch (error) {
          console.error(
            `[Expense Creation] ❌ Failed to create transaction for payer:`,
            error.message,
          );
        }
      }

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
