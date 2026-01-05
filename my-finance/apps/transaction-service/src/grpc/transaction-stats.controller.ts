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
}
