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
import { TransactionClientService } from './transaction-client.service';
import { TransactionStatsGrpcClient } from './grpc/transaction-stats.client';

type TransactionType = 'INCOME' | 'EXPENSE';

@Injectable()
export class ReportServiceService {
  private readonly logger = new Logger(ReportServiceService.name);
  private cacheHits = 0;
  private cacheMisses = 0;

  constructor(
    @Inject(REDIS_CLIENT)
    private readonly redis: Redis,
    private readonly configService: ConfigService,
    private readonly transactionClient: TransactionClientService,
    private readonly grpcClient: TransactionStatsGrpcClient,
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

  // ========== INCREMENTAL UPDATE HELPER ==========

  /**
   * Apply incremental update to cache
   * Only updates if cache exists, otherwise skips (will rebuild on next read)
   */
  private async applyIncrementalUpdate(
    userId: string,
    dateTime: Date,
    amount: number,
    category: string,
    operation: 'add' | 'remove',
  ) {
    const type = this.detectType(category);
    const factor = operation === 'add' ? 1 : -1;
    const val = factor * Math.abs(parseFloat(String(amount)));

    const month = dateTime.getMonth() + 1;
    const year = dateTime.getFullYear();
    const day = dateTime.getDate();

    const summaryKey = this.getSummaryKey(userId, year, month);
    const dailyKey = this.getDailyKey(userId, year, month);

    // Ensure currency field exists
    const defaultCurrency =
      this.configService.get<string>('DEFAULT_CURRENCY') || 'VND';
    await this.redis.hsetnx(summaryKey, 'currency', defaultCurrency);

    if (type === 'INCOME') {
      await this.redis.hincrbyfloat(summaryKey, 'income:total', val);
    } else {
      // EXPENSE
      await this.redis.hincrbyfloat(summaryKey, 'expense:total', val);
      await this.redis.hincrbyfloat(summaryKey, `category:${category}`, val);
      await this.redis.hincrbyfloat(dailyKey, `day:${day}`, val);
    }

    // Refresh TTL - 2 hours (7200 seconds) for better freshness
    await this.redis.expire(summaryKey, 7200);
    await this.redis.expire(dailyKey, 7200);
  }

  // ========== EVENT HANDLERS ==========

  async handleCreated(payload: TransactionEventDto) {
    this.logger.debug(`transaction.created ${payload.transactionId}`);
    const { after } = payload;
    if (!after) return;

    const dateTime = new Date(after.dateTime);
    const month = dateTime.getMonth() + 1;
    const year = dateTime.getFullYear();
    const summaryKey = this.getSummaryKey(payload.userId, year, month);

    try {
      // Check if cache exists
      const cacheExists = await this.redis.exists(summaryKey);

      if (!cacheExists) {
        // Cache doesn't exist → Skip update, will rebuild on next read
        this.logger.log(
          `⏭️  [Cache Skip] Cache doesn't exist for ${summaryKey}, will rebuild on next read`,
        );
      } else {
        // Cache exists → Apply incremental update
        this.logger.log(`⚡ [Incremental Update] Updating cache ${summaryKey}`);
        await this.applyIncrementalUpdate(
          payload.userId,
          dateTime,
          after.amount,
          after.category,
          'add',
        );
      }
    } catch (error: any) {
      this.logger.error(`❌ [Cache Update Failed] ${error.message}`);
      // On error, delete cache to force rebuild
      await this.redis.del(summaryKey);
    }
  }

  async handleUpdated(payload: TransactionEventDto) {
    this.logger.debug(`transaction.updated ${payload.transactionId}`);
    const { before, after } = payload;
    if (!before || !after) return;

    const beforeDate = new Date(before.dateTime);
    const afterDate = new Date(after.dateTime);

    try {
      this.logger.log(
        `⚡ [Incremental Update] Transaction updated - removing old, adding new`,
      );

      // Remove old transaction from cache
      await this.applyIncrementalUpdate(
        payload.userId,
        beforeDate,
        before.amount,
        before.category,
        'remove',
      );

      // Add new transaction to cache
      await this.applyIncrementalUpdate(
        payload.userId,
        afterDate,
        after.amount,
        after.category,
        'add',
      );
    } catch (error: any) {
      this.logger.error(`❌ [Cache Update Failed] ${error.message}`);
      // On error, delete both caches to force rebuild
      const beforeMonth = beforeDate.getMonth() + 1;
      const beforeYear = beforeDate.getFullYear();
      const afterMonth = afterDate.getMonth() + 1;
      const afterYear = afterDate.getFullYear();

      await this.redis.del(
        this.getSummaryKey(payload.userId, beforeYear, beforeMonth),
      );
      await this.redis.del(
        this.getDailyKey(payload.userId, beforeYear, beforeMonth),
      );

      if (beforeMonth !== afterMonth || beforeYear !== afterYear) {
        await this.redis.del(
          this.getSummaryKey(payload.userId, afterYear, afterMonth),
        );
        await this.redis.del(
          this.getDailyKey(payload.userId, afterYear, afterMonth),
        );
      }
    }
  }

  async handleDeleted(payload: TransactionEventDto) {
    this.logger.debug(`transaction.deleted ${payload.transactionId}`);
    const { before } = payload;
    if (!before) return;

    const dateTime = new Date(before.dateTime);

    try {
      this.logger.log(
        `⚡ [Incremental Update] Transaction deleted - removing from cache`,
      );

      // Remove transaction from cache
      await this.applyIncrementalUpdate(
        payload.userId,
        dateTime,
        before.amount,
        before.category,
        'remove',
      );
    } catch (error: any) {
      this.logger.error(`❌ [Cache Update Failed] ${error.message}`);
      // On error, delete cache to force rebuild
      const month = dateTime.getMonth() + 1;
      const year = dateTime.getFullYear();
      await this.redis.del(this.getSummaryKey(payload.userId, year, month));
      await this.redis.del(this.getDailyKey(payload.userId, year, month));
    }
  }

  // ========== CACHE-ASIDE PATTERN HELPERS ==========

  /**
   * Try to get data from Redis cache
   * Returns null if cache miss or error
   */
  private async tryGetFromCache(key: string): Promise<any> {
    try {
      const data = await this.redis.hgetall(key);

      // Check if hash has any data
      if (Object.keys(data).length > 0) {
        this.cacheHits++;
        const hitRate = (
          (this.cacheHits / (this.cacheHits + this.cacheMisses)) *
          100
        ).toFixed(2);
        this.logger.log(
          `✅ [Cache HIT] Redis key: ${key} | Hit rate: ${hitRate}%`,
        );
        return data;
      }

      this.cacheMisses++;
      this.logger.log(`❌ [Cache MISS] Redis key: ${key} (empty hash)`);
      return null;
    } catch (error: any) {
      this.cacheMisses++;
      this.logger.warn(`⚠️  [Cache ERROR] Redis unavailable: ${error.message}`);
      return null;
    }
  }

  /**
   * Try to update Redis cache
   * Does not throw on error - just logs warning
   */
  private async tryUpdateCache(
    key: string,
    data: Record<string, any>,
    ttl?: number,
  ): Promise<void> {
    try {
      // Set all hash fields
      if (Object.keys(data).length > 0) {
        await this.redis.hset(key, data);

        // Set TTL if provided
        if (ttl) {
          await this.redis.expire(key, ttl);
        }

        this.logger.log(`💾 [Cache UPDATE] Redis key: ${key}`);
      }
    } catch (error: any) {
      this.logger.warn(`⚠️  [Cache UPDATE FAILED] ${error.message}`);
      // Don't throw - data already returned to client
    }
  }

  /**
   * Aggregate transactions from raw data (SSOT fallback)
   */
  private aggregateTransactions(transactions: any[]): {
    incomeTotal: number;
    expenseTotal: number;
    categoryBreakdown: Record<string, number>;
  } {
    const result = {
      incomeTotal: 0,
      expenseTotal: 0,
      categoryBreakdown: {} as Record<string, number>,
    };

    for (const tx of transactions) {
      const amount = parseFloat(tx.amount);
      const category = tx.category;

      const type = this.detectType(category);

      if (type === 'INCOME') {
        result.incomeTotal += amount;
      } else {
        // EXPENSE (amount is negative)
        result.expenseTotal += Math.abs(amount);
        result.categoryBreakdown[category] =
          (result.categoryBreakdown[category] || 0) + Math.abs(amount);
      }
    }

    return result;
  }

  /**
   * Rebuild cache from Transaction Service (SSOT)
   */
  private async rebuildCacheFromSSoT(
    userId: string,
    monthYear: string,
    year: number,
    month: number,
  ): Promise<any> {
    this.logger.log(
      `🔄 [Rebuild Cache] Querying Transaction Service for ${monthYear}`,
    );

    // Query SSOT
    const transactions = await this.transactionClient.getTransactionsByMonth(
      userId,
      monthYear,
    );

    // Aggregate locally
    const aggregated = this.aggregateTransactions(transactions);

    // Build hash data for Redis
    const defaultCurrency =
      this.configService.get<string>('DEFAULT_CURRENCY') || 'VND';
    const hashData: Record<string, string> = {
      currency: defaultCurrency,
      'income:total': aggregated.incomeTotal.toString(),
      'expense:total': aggregated.expenseTotal.toString(),
    };

    // Add category breakdown
    for (const [category, amount] of Object.entries(
      aggregated.categoryBreakdown,
    )) {
      hashData[`category:${category}`] = amount.toString();
    }

    // Update cache for next time (2 hour TTL)
    const summaryKey = this.getSummaryKey(userId, year, month);
    await this.tryUpdateCache(summaryKey, hashData, 7200);

    return hashData;
  }

  // ========== /transactions/summary ==========

  async getMonthlySummary(
    userId: string,
    monthYear: string,
    forceRefresh: boolean = false,
  ) {
    const { month, year } = this.parseMonthYear(monthYear);
    const summaryKey = this.getSummaryKey(userId, year, month);

    // ========== PATTERN: Cache-Aside with Fallback ==========

    let hash: Record<string, any>;

    // 1️⃣ If force refresh, skip cache and rebuild from SSOT
    if (forceRefresh) {
      this.logger.log(`🔄 [Force Refresh] Bypassing cache for ${summaryKey}`);
      // Delete existing cache first
      await this.redis.del(summaryKey);
      hash = await this.rebuildCacheFromSSoT(userId, monthYear, year, month);
    } else {
      // 2️⃣ Try cache first
      hash = await this.tryGetFromCache(summaryKey);

      // 3️⃣ Cache miss → Query SSOT and rebuild cache
      if (!hash) {
        hash = await this.rebuildCacheFromSSoT(userId, monthYear, year, month);
      }
    }

    // 4️⃣ Parse and return data
    const defaultCurrency =
      this.configService.get<string>('DEFAULT_CURRENCY') || 'VND';
    const currency = hash.currency || defaultCurrency;
    const incomeTotal = parseFloat(hash['income:total'] ?? '0');
    const expenseTotal = parseFloat(hash['expense:total'] ?? '0');

    const data: Record<string, number> = {};
    for (const [field, value] of Object.entries(hash)) {
      if (field.startsWith('category:')) {
        const category = field.substring('category:'.length);
        data[category] = parseFloat(String(value));
      }
    }

    // income đưa vào data như spec
    data['income'] = incomeTotal;

    const monthStr = month.toString().padStart(2, '0');
    const displayMonthYear = `${monthStr}/${year}`;

    return {
      month: displayMonthYear,
      currency,
      data,
      totals: {
        expense: expenseTotal,
        income: incomeTotal,
        balance: incomeTotal - expenseTotal, // Net balance (income - expense)
      },
    };
  }

  // ========== /stats/line ==========

  /**
   * Build cumulative expense series for a month using gRPC
   * Queries transaction-service directly via gRPC for daily stats
   */
  private async buildCumulativeSeriesViaGrpc(
    userId: string,
    month: number,
    year: number,
  ) {
    const daysInMonth = new Date(year, month, 0).getDate();

    // Build date range for the month
    const startDate = `${year}-${month.toString().padStart(2, '0')}-01`;
    const endDate = `${year}-${(month + 1).toString().padStart(2, '0')}-01`;

    // Handle year rollover for December
    const actualEndDate =
      month === 12 ? `${year + 1}-01-01` : endDate;

    try {
      // Query daily stats via gRPC
      const dailyStats = await this.grpcClient.getDailyStats(
        userId,
        startDate,
        actualEndDate,
      );

      // Build expense per day map
      const expensePerDay: Record<number, number> = {};
      for (const stat of dailyStats) {
        const day = new Date(stat.date).getDate();
        expensePerDay[day] = stat.expense;
      }

      // Build cumulative series
      const result: { day: number; total: number }[] = [];
      let cumulative = 0;
      for (let d = 1; d <= daysInMonth; d++) {
        cumulative += expensePerDay[d] ?? 0;
        result.push({ day: d, total: cumulative });
      }

      return result;
    } catch (error: any) {
      this.logger.error(`❌ [gRPC Error] ${error.message}`);
      // Return empty series on error
      return Array.from({ length: daysInMonth }, (_, i) => ({
        day: i + 1,
        total: 0,
      }));
    }
  }

  async getLineStats(userId: string, monthYear: string) {
    const { month, year } = this.parseMonthYear(monthYear);

    this.logger.log(`📊 [LineStats] Fetching via gRPC for ${monthYear}`);

    // Get current month stats via gRPC
    const currentMonth = await this.buildCumulativeSeriesViaGrpc(
      userId,
      month,
      year,
    );

    // Get previous month stats via gRPC
    const { month: prevMonth, year: prevYear } = this.getPrevMonth(month, year);
    const previousMonth = await this.buildCumulativeSeriesViaGrpc(
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

    const defaultCurrency =
      this.configService.get<string>('DEFAULT_CURRENCY') || 'VND';
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

  // ========== ADMIN: Force Cache Rebuild ==========

  async rebuildCache(userId: string, monthYear: string) {
    const { month, year } = this.parseMonthYear(monthYear);
    const summaryKey = this.getSummaryKey(userId, year, month);
    const dailyKey = this.getDailyKey(userId, year, month);

    this.logger.log(`🔧 [Admin] Force rebuilding cache for ${summaryKey}`);

    // Delete existing cache
    await this.redis.del(summaryKey);
    await this.redis.del(dailyKey);

    // Rebuild from SSOT
    const transactions = await this.transactionClient.getTransactionsByMonth(
      userId,
      monthYear,
    );
    const aggregated = this.aggregateTransactions(transactions);

    // Build hash data for Redis
    const defaultCurrency =
      this.configService.get<string>('DEFAULT_CURRENCY') || 'VND';
    const hashData: Record<string, string> = {
      currency: defaultCurrency,
      'income:total': aggregated.incomeTotal.toString(),
      'expense:total': aggregated.expenseTotal.toString(),
    };

    // Add category breakdown
    for (const [category, amount] of Object.entries(
      aggregated.categoryBreakdown,
    )) {
      hashData[`category:${category}`] = amount.toString();
    }

    // Update cache (2 hour TTL)
    await this.tryUpdateCache(summaryKey, hashData, 7200);

    // Also rebuild daily cache for line chart
    await this.rebuildDailyCache(userId, year, month, transactions);

    this.logger.log(
      `✅ [Admin] Cache rebuilt: ${transactions.length} transactions processed`,
    );

    return {
      transactionsProcessed: transactions.length,
      cacheKey: summaryKey,
    };
  }

  private async rebuildDailyCache(
    userId: string,
    year: number,
    month: number,
    transactions: any[],
  ) {
    const dailyKey = this.getDailyKey(userId, year, month);
    const dailyData: Record<string, string> = {};

    // Aggregate by day
    for (const tx of transactions) {
      const txDate = new Date(tx.dateTime);
      const day = txDate.getDate();
      const amount = parseFloat(tx.amount);

      // Only count expenses (negative amounts)
      if (amount < 0) {
        const currentTotal = parseFloat(dailyData[`day:${day}`] || '0');
        dailyData[`day:${day}`] = (currentTotal + Math.abs(amount)).toString();
      }
    }

    // Update daily cache
    if (Object.keys(dailyData).length > 0) {
      await this.tryUpdateCache(dailyKey, dailyData, 7200);
    }
  }
}
