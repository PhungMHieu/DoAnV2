import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

interface Transaction {
  id: string;
  userId: string;
  amount: number;
  category: string;
  note: string;
  dateTime: string;
  createdAt: string;
  updatedAt: string;
}

@Injectable()
export class TransactionClientService {
  private readonly logger = new Logger(TransactionClientService.name);
  private readonly transactionServiceUrl: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.transactionServiceUrl =
      this.configService.get<string>('TRANSACTION_SERVICE_URL') ||
      'http://transaction-service:3001';
  }

  /**
   * Query all transactions for a specific month/year from Transaction Service
   * This is the SSOT (Single Source of Truth) fallback when Redis cache fails
   */
  async getTransactionsByMonth(
    userId: string,
    monthYear: string,
  ): Promise<Transaction[]> {
    try {
      this.logger.log(
        `📌 [SSOT Query] Fetching transactions from Transaction Service for user ${userId}, month ${monthYear}`,
      );

      const response = await firstValueFrom(
        this.httpService.get<Transaction[]>(`${this.transactionServiceUrl}/`, {
          params: { monthYear },
          headers: { 'x-user-id': userId },
        }),
      );

      this.logger.log(
        `✅ [SSOT Query] Retrieved ${response.data.length} transactions`,
      );

      return response.data;
    } catch (error: any) {
      this.logger.error(
        `❌ [SSOT Query] Failed to fetch transactions: ${error.message}`,
      );
      throw error;
    }
  }
}
