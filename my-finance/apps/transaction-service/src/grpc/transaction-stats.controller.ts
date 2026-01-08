import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { TransactionEntity } from '../entities/transaction.entity';

interface DailyStatsRequest {
  userId: string;
  startDate: string;
  endDate: string;
}

interface DailyStat {
  date: string;
  income: number;
  expense: number;
}

interface DailyStatsResponse {
  stats: DailyStat[];
}

interface TransactionsByMonthRequest {
  userId: string;
  monthYear: string;
}

interface TransactionItem {
  id: string;
  userId: string;
  amount: number;
  category: string;
  note: string;
  dateTime: string;
  createdAt: string;
  updatedAt: string;
}

interface TransactionsByMonthResponse {
  transactions: TransactionItem[];
}

@Controller()
export class TransactionStatsGrpcController {
  constructor(
    @InjectRepository(TransactionEntity)
    private readonly transactionRepository: Repository<TransactionEntity>,
  ) {}

  @GrpcMethod('TransactionStatsService', 'GetDailyStats')
  async getDailyStats(request: DailyStatsRequest): Promise<DailyStatsResponse> {
    const { userId, startDate, endDate } = request;

    // Query aggregated daily stats directly from database
    const result = await this.transactionRepository
      .createQueryBuilder('t')
      .select("TO_CHAR(t.dateTime, 'YYYY-MM-DD')", 'date')
      .addSelect(
        "COALESCE(SUM(CASE WHEN LOWER(t.category) = 'income' THEN t.amount ELSE 0 END), 0)",
        'income',
      )
      .addSelect(
        "COALESCE(SUM(CASE WHEN LOWER(t.category) != 'income' THEN t.amount ELSE 0 END), 0)",
        'expense',
      )
      .where('t.userId = :userId', { userId })
      .andWhere('t.dateTime >= :startDate', { startDate: new Date(startDate) })
      .andWhere('t.dateTime < :endDate', { endDate: new Date(endDate) })
      .groupBy("TO_CHAR(t.dateTime, 'YYYY-MM-DD')")
      .orderBy('date', 'ASC')
      .getRawMany();

    const stats: DailyStat[] = result.map((row) => ({
      date: row.date,
      income: parseFloat(row.income) || 0,
      expense: parseFloat(row.expense) || 0,
    }));

    return { stats };
  }

  @GrpcMethod('TransactionStatsService', 'GetTransactionsByMonth')
  async getTransactionsByMonth(
    request: TransactionsByMonthRequest,
  ): Promise<TransactionsByMonthResponse> {
    const { userId, monthYear } = request;

    // Parse monthYear (MM/YYYY)
    const parts = monthYear.split('/');
    if (parts.length !== 2) {
      return { transactions: [] };
    }

    const month = parseInt(parts[0], 10);
    const year = parseInt(parts[1], 10);

    if (isNaN(month) || isNaN(year) || month < 1 || month > 12) {
      return { transactions: [] };
    }

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59, 999);

    const transactions = await this.transactionRepository.find({
      where: {
        userId,
        dateTime: Between(startDate, endDate),
      },
      order: { dateTime: 'DESC' },
    });

    const items: TransactionItem[] = transactions.map((tx) => ({
      id: tx.id,
      userId: tx.userId,
      amount: parseFloat(String(tx.amount)),
      category: tx.category,
      note: tx.note || '',
      dateTime: tx.dateTime.toISOString(),
      createdAt: tx.dateTime.toISOString(), // Use dateTime as createdAt since entity doesn't have createdAt
      updatedAt: tx.dateTime.toISOString(), // Use dateTime as updatedAt since entity doesn't have updatedAt
    }));

    return { transactions: items };
  }
}
