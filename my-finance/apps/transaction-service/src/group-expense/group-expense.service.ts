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
import { TransactionEntity } from '../entities/transaction.entity';
import { TransactionServiceService } from '../transaction-service.service';
import { GroupClientService } from './group-client.service';
import {
  PaymentHistoryItem,
  PaymentHistoryResponse,
  DebtItem,
  OwedToMeItem,
} from './dto';
import { GroupWebSocketGateway } from '@app/websocket-common';

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
    private readonly wsGateway: GroupWebSocketGateway,
  ) {}

  // ========== PUBLIC ==========

  async createExpenseEqualSplit(params: {
    groupId: string;
    title: string;
    transactions: { amount: number; category: string; note?: string; dateTime?: Date }[];
    paidByMemberId: string;
    paidByUserId: string;
    paidByMemberName: string;
    participants: { memberId: string; userId: string; memberName: string }[];
    createdByUserId: string;
    date?: string;
  }): Promise<GroupExpense> {
    const {
      groupId,
      title,
      transactions,
      paidByMemberId,
      paidByUserId,
      paidByMemberName,
      participants,
      createdByUserId,
      date,
    } = params;

    if (!participants?.length) {
      throw new BadRequestException('participants cannot be empty');
    }

    if (!transactions?.length) {
      throw new BadRequestException('transactions cannot be empty');
    }

    // Tính tổng amount từ transactions
    const totalAmount = transactions.reduce((sum, tx) => sum + tx.amount, 0);
    const centsTotal = this.toCents(totalAmount);

    // chia đều theo cents để không lệch
    const n = participants.length;
    const base = Math.floor(centsTotal / n);
    let remainder = centsTotal - base * n;

    const shares = participants.map((p) => {
      const extra = remainder > 0 ? 1 : 0; // phân bổ phần dư
      remainder -= extra;
      return { memberId: p.memberId, userId: p.userId, memberName: p.memberName, cents: base + extra };
    });

    return this.persistExpenseWithShares({
      groupId,
      title,
      paidByMemberId,
      paidByUserId,
      paidByMemberName,
      createdByUserId,
      splitType: 'equal',
      sharesCents: shares,
      transactions,
      date,
    });
  }

  /**
   * body expected:
   * {
   *   title, paidByMemberId, paidByUserId, paidByMemberName, splitType:"exact",
   *   transactions:[{amount, category, note?, dateTime?}],
   *   exactSplits:[{memberId, userId, memberName, amount}]
   * }
   */
  async createExpenseExactSplit(
    groupId: string,
    body: any,
    createdByUserId: string,
  ) {
    const title = this.requireString(body?.title, 'title');
    const paidByMemberId = this.requireString(
      body?.paidByMemberId,
      'paidByMemberId',
    );
    const paidByUserId = this.requireString(body?.paidByUserId, 'paidByUserId');
    const paidByMemberName = this.requireString(body?.paidByMemberName, 'paidByMemberName');
    const date = body?.date;

    // Validate transactions
    const transactions = body?.transactions;
    if (!Array.isArray(transactions) || transactions.length === 0) {
      throw new BadRequestException('transactions must be non-empty array');
    }

    const parsedTransactions = transactions.map((tx: any, idx: number) => ({
      amount: this.requirePositiveNumber(tx?.amount, `transactions[${idx}].amount`),
      category: this.requireString(tx?.category, `transactions[${idx}].category`),
      note: tx?.note,
      dateTime: tx?.dateTime ? new Date(tx.dateTime) : undefined,
    }));

    const totalAmount = parsedTransactions.reduce((sum, tx) => sum + tx.amount, 0);

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
      const memberName = this.requireString(
        s?.memberName,
        `exactSplits[${idx}].memberName`,
      );
      const shareAmount = this.requireNonNegativeNumber(
        s?.amount,
        `exactSplits[${idx}].amount`,
      );
      return { memberId, userId, memberName, cents: this.toCents(shareAmount) };
    });

    const sumCents = sharesCents.reduce((acc, x) => acc + x.cents, 0);
    const totalCents = this.toCents(totalAmount);

    if (sumCents !== totalCents) {
      throw new BadRequestException(
        `Sum of splits (${this.fromCents(sumCents)}) must equal total amount (${totalAmount})`,
      );
    }

    return this.persistExpenseWithShares({
      groupId,
      title,
      paidByMemberId,
      paidByUserId,
      paidByMemberName,
      createdByUserId,
      splitType: 'exact',
      sharesCents,
      transactions: parsedTransactions,
      date,
    });
  }

  /**
   * body expected:
   * {
   *   title, paidByMemberId, paidByUserId, paidByMemberName, splitType:"percent",
   *   transactions:[{amount, category, note?, dateTime?}],
   *   percentSplits:[{memberId, userId, memberName, percent}]
   * }
   */
  async createExpensePercentSplit(
    groupId: string,
    body: any,
    createdByUserId: string,
  ) {
    const title = this.requireString(body?.title, 'title');
    const paidByMemberId = this.requireString(
      body?.paidByMemberId,
      'paidByMemberId',
    );
    const paidByUserId = this.requireString(body?.paidByUserId, 'paidByUserId');
    const paidByMemberName = this.requireString(body?.paidByMemberName, 'paidByMemberName');
    const date = body?.date;

    // Validate transactions
    const transactions = body?.transactions;
    if (!Array.isArray(transactions) || transactions.length === 0) {
      throw new BadRequestException('transactions must be non-empty array');
    }

    const parsedTransactions = transactions.map((tx: any, idx: number) => ({
      amount: this.requirePositiveNumber(tx?.amount, `transactions[${idx}].amount`),
      category: this.requireString(tx?.category, `transactions[${idx}].category`),
      note: tx?.note,
      dateTime: tx?.dateTime ? new Date(tx.dateTime) : undefined,
    }));

    const totalAmount = parsedTransactions.reduce((sum, tx) => sum + tx.amount, 0);
    const totalCents = this.toCents(totalAmount);

    const splits = body?.percentSplits;
    if (!Array.isArray(splits) || splits.length === 0) {
      throw new BadRequestException('percentSplits must be non-empty array');
    }

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
      const memberName = this.requireString(
        s?.memberName,
        `percentSplits[${idx}].memberName`,
      );
      const percent = this.requireNonNegativeNumber(
        s?.percent,
        `percentSplits[${idx}].percent`,
      );
      return { memberId, userId, memberName, percent };
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
      return { memberId: x.memberId, userId: x.userId, memberName: x.memberName, floor, frac };
    });

    const used = computed.reduce((acc, x) => acc + x.floor, 0);
    let remain = totalCents - used;

    // phân bổ phần dư cho các frac lớn nhất
    computed.sort((a, b) => b.frac - a.frac);

    const sharesCents = computed.map((x) => ({
      memberId: x.memberId,
      userId: x.userId,
      memberName: x.memberName,
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
      paidByMemberName,
      createdByUserId,
      splitType: 'percent',
      sharesCents,
      transactions: parsedTransactions,
      date,
    });
  }

  async getExpensesOfGroup(groupId: string) {
    const expenses = await this.expenseRepo.find({
      where: { groupId },
      relations: ['shares', 'transactions'],
      order: { createdAt: 'DESC' },
    });

    return expenses.map((exp) => this.mapExpenseWithTotalAmount(exp));
  }

  async getExpenseDetail(groupId: string, expenseId: string) {
    const exp = await this.expenseRepo.findOne({
      where: { id: expenseId, groupId },
      relations: ['shares', 'transactions'],
    });
    if (!exp) throw new NotFoundException('Expense not found');
    return this.mapExpenseWithTotalAmount(exp);
  }

  /**
   * Get all expenses where current member is involved (paid or participated)
   */
  async getMyExpenses(groupId: string, memberId: string) {
    // Lấy tất cả expense trong group
    const allExpenses = await this.expenseRepo.find({
      where: { groupId },
      relations: ['shares', 'transactions'],
      order: { createdAt: 'DESC' },
    });

    // Lọc expense mà member này có tham gia (là người trả hoặc có trong shares)
    const filtered = allExpenses.filter((expense) => {
      // Member là người trả tiền
      if (expense.paidByMemberId === memberId) return true;
      // Member có trong danh sách shares
      return expense.shares.some((share) => share.memberId === memberId);
    });

    return filtered.map((exp) => this.mapExpenseWithTotalAmount(exp));
  }

  /**
   * Get all debts for a specific member in a group
   * Returns expenses where this member owes money (share amount > 0 AND member didn't pay)
   */
  async getMyDebts(groupId: string, memberId: string): Promise<DebtItem[]> {
    const shares = await this.shareRepo.find({
      where: { memberId },
      relations: ['expense', 'expense.transactions'],
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
        totalAmount: share.expense.totalAmount.toFixed(2),
        myShare: share.amount,
        paidByMemberId: share.expense.paidByMemberId,
        paidByMemberName: share.expense.paidByMemberName || `Member ${share.expense.paidByMemberId}`,
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
      const debtorTx = await this.transactionServiceService.createTransaction(
        debtorUserId,
        {
          amount: parseFloat(share.amount),
          category: 'Group Settlement',
          note: `Group: ${expense.title}`,
          dateTime: new Date(),
        } as any,
      );

      // 6. Create transaction for PAYER (income)
      const payerTx = await this.transactionServiceService.createTransaction(
        payerUserId,
        {
          amount: parseFloat(share.amount),
          category: 'Income',
          note: `Group: ${expense.title}`,
          dateTime: new Date(),
        } as any,
      );

      const result = {
        shareId: share.id,
        isPaid: share.isPaid,
        paidAt: share.paidAt,
        debtorTransactionId: debtorTx.id,
        payerTransactionId: payerTx.id,
      };

      // Emit WebSocket event for share marked as paid
      this.wsGateway.emitShareMarkedPaid({
        groupId,
        expenseId: expense.id,
        shareId: share.id,
        memberId: share.memberId,
        memberName: share.memberName,
        amount: share.amount,
        paidByMemberId: expense.paidByMemberId,
        paidByMemberName: expense.paidByMemberName,
        paidAt: share.paidAt!,
        timestamp: new Date(),
      });

      return result;
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
      relations: ['shares', 'transactions'],
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
          totalAmount: expense.totalAmount.toFixed(2),
          shareAmount: share.amount,
          debtorMemberId: share.memberId,
          debtorMemberName: share.memberName || `Member ${share.memberId}`,
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
      relations: ['shares', 'transactions'],
      order: { createdAt: 'DESC' },
    });

    const payments: PaymentHistoryItem[] = [];
    let totalPaid = 0;
    let totalReceived = 0;

    for (const expense of expenses) {
      const expenseTotal = expense.totalAmount;

      // A. Current user is the PAYER
      if (expense.paidByMemberId === memberId) {
        payments.push({
          date: expense.createdAt,
          type: 'paid',
          amount: expenseTotal,
          expenseId: expense.id,
          expenseTitle: expense.title,
          category: 'Group Expense',
          note: 'Đã thanh toán cho nhóm',
        });
        totalPaid += expenseTotal;
      }

      // B. Current user RECEIVED payment
      if (expense.paidByMemberId === memberId) {
        const paidShares = expense.shares.filter(
          (s) => s.memberId !== memberId && s.isPaid,
        );

        for (const share of paidShares) {
          // Sử dụng memberName từ database thay vì gọi API
          const memberName = share.memberName || `Member ${share.memberId}`;

          payments.push({
            date: share.paidAt || expense.createdAt,
            type: 'received',
            amount: parseFloat(share.amount),
            expenseId: expense.id,
            expenseTitle: expense.title,
            category: 'Group Expense',
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
        // Sử dụng paidByMemberName từ database thay vì gọi API
        const payerName = expense.paidByMemberName || `Member ${expense.paidByMemberId}`;

        payments.push({
          date: myShare.paidAt || expense.createdAt,
          type: 'paid',
          amount: parseFloat(myShare.amount),
          expenseId: expense.id,
          expenseTitle: expense.title,
          category: 'Group Expense',
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
    paidByMemberName: string;
    createdByUserId: string;
    splitType: SplitType;
    sharesCents: { memberId: string; userId: string; memberName: string; cents: number }[];
    transactions: { amount: number; category: string; note?: string; dateTime?: Date }[];
    date?: string;
  }) {
    const {
      groupId,
      title,
      paidByMemberId,
      paidByUserId,
      paidByMemberName,
      createdByUserId,
      splitType,
      sharesCents,
      transactions,
      date,
    } = input;

    // validate memberId duplicates
    const seen = new Set<string>();
    for (const s of sharesCents) {
      if (seen.has(s.memberId))
        throw new BadRequestException('Duplicate memberId in shares/splits');
      seen.add(s.memberId);
    }

    // Sử dụng ngày từ request, nếu không có thì dùng ngày hiện tại
    const expenseDate = date ? new Date(date) : new Date();

    return this.dataSource.transaction(async (manager) => {
      // 1. Tạo expense trước
      const expense = manager.create(GroupExpense, {
        groupId,
        title,
        paidByMemberId,
        paidByMemberName,
        createdByUserId,
        createdAt: expenseDate,
        splitType,
      });

      const savedExpense = await manager.save(expense);

      // 2. Tạo các transaction và link vào expense
      const createdTransactions: TransactionEntity[] = [];
      for (const tx of transactions) {
        const transaction = manager.create(TransactionEntity, {
          userId: paidByUserId,
          amount: tx.amount,
          category: tx.category,
          note: tx.note || `Group: ${title}`,
          dateTime: tx.dateTime || expenseDate,
          groupExpenseId: savedExpense.id,
        });
        const savedTx = await manager.save(transaction);
        createdTransactions.push(savedTx);
      }
      savedExpense.transactions = createdTransactions;

      // 3. Tạo shares với userId và memberName từ request
      const shares = sharesCents.map((s) =>
        manager.create(GroupExpenseShare, {
          expenseId: savedExpense.id,
          memberId: s.memberId,
          memberName: s.memberName,
          amount: this.fromCents(s.cents),
          userId: s.userId,
          isPaid: s.memberId === paidByMemberId,
        }),
      );

      await manager.save(shares);
      savedExpense.shares = shares;

      // Tính tổng amount từ transactions
      const totalAmount = savedExpense.totalAmount;

      // Emit WebSocket event for expense created
      this.wsGateway.emitExpenseCreated({
        groupId,
        expense: {
          id: savedExpense.id,
          title: savedExpense.title,
          amount: totalAmount.toFixed(2),
          paidByMemberId: savedExpense.paidByMemberId,
          paidByMemberName: savedExpense.paidByMemberName,
          splitType: savedExpense.splitType,
          createdAt: savedExpense.createdAt,
        },
        shares: shares.map((s) => ({
          id: s.id,
          memberId: s.memberId,
          memberName: s.memberName,
          amount: s.amount,
          isPaid: s.isPaid,
        })),
        createdByUserId,
        timestamp: new Date(),
      });

      console.log(
        `[Expense Creation] ✅ Created expense ${savedExpense.id} with ${createdTransactions.length} transactions, total: ${totalAmount}`,
      );

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

  /**
   * Upload proof image for a payment
   */
  async uploadProof(
    shareId: string,
    memberId: string,
    groupId: string,
    imageUrl: string,
  ) {
    const share = await this.shareRepo.findOne({
      where: { id: shareId },
      relations: ['expense'],
    });

    if (!share) {
      throw new NotFoundException('Share not found');
    }

    // Verify share belongs to this group
    if (share.expense.groupId !== groupId) {
      throw new BadRequestException('Share does not belong to this group');
    }

    // Verify current user is the debtor (owner of the share)
    if (share.memberId !== memberId) {
      throw new ForbiddenException('Only the debtor can upload proof');
    }

    // Cannot upload proof if already paid
    if (share.isPaid) {
      throw new BadRequestException('Cannot upload proof for already paid share');
    }

    // Update proof fields
    share.proofImageUrl = imageUrl;
    share.proofStatus = 'pending';
    share.proofUploadedAt = new Date();

    await this.shareRepo.save(share);

    return {
      shareId: share.id,
      proofImageUrl: share.proofImageUrl,
      proofStatus: share.proofStatus,
      proofUploadedAt: share.proofUploadedAt,
    };
  }

  /**
   * Approve or reject proof (for payer)
   */
  async reviewProof(
    shareId: string,
    memberId: string,
    groupId: string,
    approved: boolean,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const shareRepo = manager.getRepository(GroupExpenseShare);

      const share = await shareRepo.findOne({
        where: { id: shareId },
        relations: ['expense', 'expense.shares'],
      });

      if (!share) {
        throw new NotFoundException('Share not found');
      }

      // Verify share belongs to this group
      if (share.expense.groupId !== groupId) {
        throw new BadRequestException('Share does not belong to this group');
      }

      // Verify current user is the payer
      if (share.expense.paidByMemberId !== memberId) {
        throw new ForbiddenException('Only the payer can review proof');
      }

      // Must have pending proof to review
      if (share.proofStatus !== 'pending') {
        throw new BadRequestException('No pending proof to review');
      }

      if (approved) {
        share.proofStatus = 'approved';
        share.isPaid = true;
        share.paidAt = new Date();

        // Get payer's userId from shares
        const payerShare = share.expense.shares.find(
          (s) => s.memberId === share.expense.paidByMemberId,
        );
        if (!payerShare?.userId) {
          throw new BadRequestException('Payer userId not found');
        }

        if (!share.userId) {
          throw new BadRequestException('Debtor has not joined the group yet');
        }

        // Create settlement transactions
        await this.transactionServiceService.createTransaction(
          share.userId,
          {
            amount: parseFloat(share.amount),
            category: 'Group Settlement',
            note: `Group: ${share.expense.title}`,
            dateTime: new Date(),
          } as any,
        );

        await this.transactionServiceService.createTransaction(
          payerShare.userId,
          {
            amount: parseFloat(share.amount),
            category: 'Income',
            note: `Group: ${share.expense.title}`,
            dateTime: new Date(),
          } as any,
        );

        // Emit WebSocket event
        this.wsGateway.emitShareMarkedPaid({
          groupId,
          expenseId: share.expense.id,
          shareId: share.id,
          memberId: share.memberId,
          memberName: share.memberName,
          amount: share.amount,
          paidByMemberId: share.expense.paidByMemberId,
          paidByMemberName: share.expense.paidByMemberName,
          paidAt: share.paidAt!,
          timestamp: new Date(),
        });
      } else {
        share.proofStatus = 'rejected';
      }

      await shareRepo.save(share);

      return {
        shareId: share.id,
        proofStatus: share.proofStatus,
        isPaid: share.isPaid,
        paidAt: share.paidAt,
      };
    });
  }

  /**
   * Map expense entity to include totalAmount in response
   */
  private mapExpenseWithTotalAmount(expense: GroupExpense) {
    return {
      id: expense.id,
      title: expense.title,
      groupId: expense.groupId,
      paidByMemberId: expense.paidByMemberId,
      paidByMemberName: expense.paidByMemberName,
      createdByUserId: expense.createdByUserId,
      splitType: expense.splitType,
      createdAt: expense.createdAt,
      totalAmount: expense.totalAmount,
      transactions: expense.transactions,
      shares: expense.shares,
    };
  }
}
