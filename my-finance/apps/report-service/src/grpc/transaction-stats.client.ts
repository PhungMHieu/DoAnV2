import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Client,
  ClientGrpc,
  Transport,
  ClientProxyFactory,
} from '@nestjs/microservices';
import { join } from 'path';
import { Observable, firstValueFrom } from 'rxjs';

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

interface TransactionStatsService {
  getDailyStats(request: DailyStatsRequest): Observable<DailyStatsResponse>;
  getTransactionsByMonth(request: TransactionsByMonthRequest): Observable<TransactionsByMonthResponse>;
}

@Injectable()
export class TransactionStatsGrpcClient implements OnModuleInit {
  private readonly logger = new Logger(TransactionStatsGrpcClient.name);
  private transactionStatsService: TransactionStatsService;
  private client: ClientGrpc;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const grpcUrl =
      this.configService.get<string>('TRANSACTION_GRPC_URL') ||
      'transaction-service:50051';

    // In Docker: /app/proto/transaction.proto
    // In dev: ../../../../proto/transaction.proto
    const isProduction = this.configService.get<string>('NODE_ENV') === 'production';
    const protoPath = isProduction
      ? join(process.cwd(), 'proto/transaction.proto')
      : join(__dirname, '../../../../proto/transaction.proto');

    this.client = ClientProxyFactory.create({
      transport: Transport.GRPC,
      options: {
        package: 'transaction',
        protoPath,
        url: grpcUrl,
      },
    }) as ClientGrpc;

    this.transactionStatsService =
      this.client.getService<TransactionStatsService>('TransactionStatsService');

    this.logger.log(`gRPC client connected to ${grpcUrl}`);
  }

  /**
   * Get daily statistics for a date range
   */
  async getDailyStats(
    userId: string,
    startDate: string,
    endDate: string,
  ): Promise<DailyStat[]> {
    try {
      this.logger.log(
        `📡 [gRPC] Fetching daily stats for user ${userId} from ${startDate} to ${endDate}`,
      );

      const response = await firstValueFrom(
        this.transactionStatsService.getDailyStats({
          userId,
          startDate,
          endDate,
        }),
      );

      this.logger.log(
        `✅ [gRPC] Retrieved ${response.stats?.length || 0} daily stats`,
      );

      return response.stats || [];
    } catch (error: any) {
      this.logger.error(`❌ [gRPC] Failed to fetch daily stats: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get transactions by month for summary calculation
   */
  async getTransactionsByMonth(
    userId: string,
    monthYear: string,
  ): Promise<TransactionItem[]> {
    try {
      this.logger.log(
        `📡 [gRPC] Fetching transactions for user ${userId}, month ${monthYear}`,
      );

      const response = await firstValueFrom(
        this.transactionStatsService.getTransactionsByMonth({
          userId,
          monthYear,
        }),
      );

      this.logger.log(
        `✅ [gRPC] Retrieved ${response.transactions?.length || 0} transactions`,
      );

      return response.transactions || [];
    } catch (error: any) {
      this.logger.error(`❌ [gRPC] Failed to fetch transactions: ${error.message}`);
      throw error;
    }
  }
}
