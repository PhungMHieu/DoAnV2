// apps/report-service/src/report.service.ts
import { REDIS_CLIENT } from '@app/redis-common';
import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { EventPattern, Payload } from '@nestjs/microservices';
import Redis from 'ioredis';
import { lastValueFrom } from 'rxjs';

type TransactionType = 'INCOME' | 'EXPENSE';

// ===== Event payloads khớp với transaction-service =====

interface TransactionCreatedEvent {
  userId: string;
  transactionId: string;
  amount: number;
  category: string;
  dateTime: string | Date;
}

interface TransactionUpdatedEvent {
  userId: string;
  transactionId: string;
  before: {
    amount: number;
    category: string;
    dateTime: string | Date;
  };
  after: {
    amount: number;
    category: string;
    dateTime: string | Date;
  };
}

interface TransactionDeletedEvent {
  userId: string;
  transactionId: string;
  amount: number;
  category: string;
  dateTime: string | Date;
}

@Injectable()
export class ReportServiceService {
  private readonly logger = new Logger(ReportServiceService.name);

  constructor(
    @Inject(REDIS_CLIENT)
    private readonly redis: Redis,          // Redis từ lib redis-common
    private readonly http: HttpService,     // dùng để gọi sang transaction-service lấy balance
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
    await this.redis.hsetnx(summaryKey, 'currency', 'VND');

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

  // ========== EVENT HANDLERS (RabbitMQ) ==========

  @EventPattern('transaction.created')
  async handleCreated(@Payload() payload: TransactionCreatedEvent) {
    this.logger.debug(
      `Received transaction.created ${payload.transactionId} for user ${payload.userId}`,
    );

    await this.applyTransactionDelta(
      payload.userId,
      new Date(payload.dateTime),
      payload.amount,
      payload.category,
      1,
    );
  }

  @EventPattern('transaction.updated')
  async handleUpdated(@Payload() payload: TransactionUpdatedEvent) {
    this.logger.debug(
      `Received transaction.updated ${payload.transactionId} for user ${payload.userId}`,
    );

    // rollback old
    await this.applyTransactionDelta(
      payload.userId,
      new Date(payload.before.dateTime),
      payload.before.amount,
      payload.before.category,
      -1,
    );

    // apply new
    await this.applyTransactionDelta(
      payload.userId,
      new Date(payload.after.dateTime),
      payload.after.amount,
      payload.after.category,
      1,
    );
  }

  @EventPattern('transaction.deleted')
  async handleDeleted(@Payload() payload: TransactionDeletedEvent) {
    this.logger.debug(
      `Received transaction.deleted ${payload.transactionId} for user ${payload.userId}`,
    );

    await this.applyTransactionDelta(
      payload.userId,
      new Date(payload.dateTime),
      payload.amount,
      payload.category,
      -1,
    );
  }

  // ========== GỌI SANG TRANSACTION-SERVICE LẤY BALANCE ==========

  private async getAccountBalance(userId: string): Promise<number> {
    // HttpModule trong ReportModule đã set baseURL = TRANSACTION_SERVICE_URL
    const res$ = this.http.get('/account/balance', {
      headers: {
        'x-user-id': userId,
      },
    });

    const res = await lastValueFrom(res$);
    return Number(res$.data?.balance ?? 0);
  }

  // ========== /transactions/summary ==========

  async getMonthlySummary(userId: string, monthYear: string) {
    const { month, year } = this.parseMonthYear(monthYear);
    const summaryKey = this.getSummaryKey(userId, year, month);

    const hash = await this.redis.hgetall(summaryKey);

    const currency = hash.currency || 'VND';
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
    const balance = await this.getAccountBalance(userId);

    const monthStr = month.toString().padStart(2, '0');
    const displayMonthYear = `${monthStr}/${year}`;

    return {
      month: displayMonthYear,
      currency,
      data,
      totals: {
        expense: expenseTotal,
        income: incomeTotal,
        balance,
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

    const currency = hash.currency || 'VND';
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
