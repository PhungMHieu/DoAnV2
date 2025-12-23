// apps/report-service/src/report.service.ts
import { REDIS_CLIENT } from '@app/redis-common';
import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { TransactionEventDto } from './dto';

type TransactionType = 'INCOME' | 'EXPENSE';

@Injectable()
export class ReportServiceService {
  private readonly logger = new Logger(ReportServiceService.name);

  constructor(
    @Inject(REDIS_CLIENT)
    private readonly redis: Redis,
    private readonly configService: ConfigService,
  ) {}

  // ========== HELPER ==========

  private detectType(category: string): TransactionType {
    return category.toLowerCase() === 'income' ? 'INCOME' : 'EXPENSE';
  }

  private parseMonthYear(monthYear: string) {
    const [monthStr, yearStr] = (monthYear || '').split('/');
    const month = Number(monthStr);
    const year = Number(yearStr);
    if (!month || !year || month < 1 || month > 12) {
      throw new BadRequestException('monthYear phải dạng MM/YYYY');
    }
    return { month, year };
  }

  private getPrevMonth(month: number, year: number) {
    if (month === 1) return { month: 12, year: year - 1 };
    return { month: month - 1, year };
  }

  private getSummaryKey(userId: string, year: number, month: number) {
    const m = month.toString().padStart(2, '0');
    return `user:${userId}:month:${year}-${m}:summary`;
  }

  private getDailyKey(userId: string, year: number, month: number) {
    const m = month.toString().padStart(2, '0');
    return `user:${userId}:month:${year}-${m}:daily`;
  }

  private async applyTransactionDelta(
    userId: string,
    dateTime: Date,
    amount: number,
    category: string,
    factor: 1 | -1,
  ) {
    const type = this.detectType(category);
    const val = factor * Number(amount);

    const month = dateTime.getMonth() + 1;
    const year = dateTime.getFullYear();
    const day = dateTime.getDate();

    const summaryKey = this.getSummaryKey(userId, year, month);
    const dailyKey = this.getDailyKey(userId, year, month);

    // đảm bảo có currency
    const defaultCurrency = this.configService.get<string>('DEFAULT_CURRENCY') || 'VND';
    await this.redis.hsetnx(summaryKey, 'currency', defaultCurrency);

    if (type === 'INCOME') {
      await this.redis.hincrbyfloat(summaryKey, 'income:total', val);
    } else {
      // EXPENSE
      await this.redis.hincrbyfloat(summaryKey, 'expense:total', val);
      await this.redis.hincrbyfloat(
        summaryKey,
        `category:${category}`,
        val,
      );
      await this.redis.hincrbyfloat(dailyKey, `day:${day}`, val);
    }
  }

  // ========== EVENT HANDLERS ==========

  async handleCreated(payload: TransactionEventDto) {
    this.logger.debug(`transaction.created ${payload.transactionId}`);
    const { after } = payload;
    if (!after) return;
    await this.applyTransactionDelta(
      payload.userId,
      new Date(after.dateTime),
      after.amount,
      after.category,
      1,
    );
  }

  async handleUpdated(payload: TransactionEventDto) {
    this.logger.debug(`transaction.updated ${payload.transactionId}`);
    const { before, after } = payload;
    if (!before || !after) return;
    // Rollback old
    await this.applyTransactionDelta(
      payload.userId,
      new Date(before.dateTime),
      before.amount,
      before.category,
      -1,
    );
    // Apply new
    await this.applyTransactionDelta(
      payload.userId,
      new Date(after.dateTime),
      after.amount,
      after.category,
      1,
    );
  }

  async handleDeleted(payload: TransactionEventDto) {
    this.logger.debug(`transaction.deleted ${payload.transactionId}`);
    const { before } = payload;
    if (!before) return;
    await this.applyTransactionDelta(
      payload.userId,
      new Date(before.dateTime),
      before.amount,
      before.category,
      -1,
    );
  }

  // ========== /transactions/summary ==========

  async getMonthlySummary(userId: string, monthYear: string) {
    const { month, year } = this.parseMonthYear(monthYear);
    const summaryKey = this.getSummaryKey(userId, year, month);

    const hash = await this.redis.hgetall(summaryKey);

    const defaultCurrency = this.configService.get<string>('DEFAULT_CURRENCY') || 'VND';
    const currency = hash.currency || defaultCurrency;
    const incomeTotal = parseFloat(hash['income:total'] ?? '0');
    const expenseTotal = parseFloat(hash['expense:total'] ?? '0');

    const data: Record<string, number> = {};
    for (const [field, value] of Object.entries(hash)) {
      if (field.startsWith('category:')) {
        const category = field.substring('category:'.length);
        data[category] = parseFloat(value);
      }
    }

    // income đưa vào data như spec
    data['income'] = incomeTotal;

    // balance lấy từ Account (Transaction-Service) → số dư từ lúc tạo acc
    // const balance = await this.getAccountBalance(userId);

    const monthStr = month.toString().padStart(2, '0');
    const displayMonthYear = `${monthStr}/${year}`;

    return {
      month: displayMonthYear,
      currency,
      data,
      totals: {
        expense: expenseTotal,
        income: incomeTotal,
      },
    };
  }

  // ========== /stats/line ==========

  private async buildCumulativeSeries(
    userId: string,
    month: number,
    year: number,
  ) {
    const dailyKey = this.getDailyKey(userId, year, month);
    const dailyHash = await this.redis.hgetall(dailyKey);

    const daysInMonth = new Date(year, month, 0).getDate();
    const sumPerDay: Record<number, number> = {};

    for (const [field, value] of Object.entries(dailyHash)) {
      if (field.startsWith('day:')) {
        const day = Number(field.substring('day:'.length));
        sumPerDay[day] = parseFloat(value);
      }
    }

    const result: { day: number; total: number }[] = [];
    let cumulative = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      cumulative += sumPerDay[d] ?? 0;
      result.push({ day: d, total: cumulative });
    }
    return result;
  }

  async getLineStats(userId: string, monthYear: string) {
    const { month, year } = this.parseMonthYear(monthYear);

    const currentMonth = await this.buildCumulativeSeries(
      userId,
      month,
      year,
    );

    const { month: prevMonth, year: prevYear } = this.getPrevMonth(
      month,
      year,
    );

    const previousMonth = await this.buildCumulativeSeries(
      userId,
      prevMonth,
      prevYear,
    );

    return {
      currentMonth,
      previousMonth,
    };
  }

  // ========== /stats/pie ==========

  async getPieStats(userId: string, monthYear: string) {
    const { month, year } = this.parseMonthYear(monthYear);
    const summaryKey = this.getSummaryKey(userId, year, month);
    const hash = await this.redis.hgetall(summaryKey);

    const defaultCurrency = this.configService.get<string>('DEFAULT_CURRENCY') || 'VND';
    const currency = hash.currency || defaultCurrency;
    const data: Record<string, number> = {};

    for (const [field, value] of Object.entries(hash)) {
      if (field.startsWith('category:')) {
        const category = field.substring('category:'.length);
        data[category] = parseFloat(value);
      }
    }

    const monthStr = month.toString().padStart(2, '0');
    const displayMonthYear = `${monthStr}/${year}`;

    return {
      month: displayMonthYear,
      currency,
      data,
    };
  }
}
