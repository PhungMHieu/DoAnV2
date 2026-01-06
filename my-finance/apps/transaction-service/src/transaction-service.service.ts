import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { TransactionEntity } from './entities/transaction.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { ClientProxy } from '@nestjs/microservices';
import { AccountEntity } from './entities/account.entity';
// ML Services (direct imports - no HTTP calls needed)
import { CategoryPredictionService } from './ml/categories/category-prediction.service';
import { AmountExtractorService } from './ml/amount-extraction/amount-extractor.service';

@Injectable()
export class TransactionServiceService {
  private readonly logger = new Logger(TransactionServiceService.name);
  constructor(
    @InjectRepository(TransactionEntity)
    private readonly transactionRepository: Repository<TransactionEntity>,
    private readonly dataSource: DataSource,
    @Inject('REPORT_SERVICE')
    private readonly reportClient: ClientProxy,
    // ML Services (direct injection - no HTTP calls)
    private readonly categoryPredictionService: CategoryPredictionService,
    private readonly amountExtractorService: AmountExtractorService,
  ) {}
  private getDelta(category: string, amount: number) {
    return category.toLowerCase() === 'income' ? amount : -amount;
  }

  async createTransaction(userId: string, data: TransactionEntity) {
    const savedTx = await this.dataSource.transaction(async (manager) => {
      const txRepo = manager.getRepository(TransactionEntity);
      const accountRepo = manager.getRepository(AccountEntity);

      // 1. Đảm bảo account tồn tại
      const account = await this.ensureAccount(userId, manager);

      // 2. Tạo transaction (normalize amount to always be positive)
      const normalizedAmount = Math.abs(parseFloat(String(data.amount)));
      const transaction = txRepo.create({
        ...data,
        userId,
        amount: normalizedAmount, // Always store positive amount
      });
      const savedTx = await txRepo.save(transaction);

      // 3. Update balance (atomic)
      const delta = this.getDelta(savedTx.category, savedTx.amount);

      await accountRepo.update(
        { id: account.id },
        { balance: () => `balance + ${delta}` },
      );

      return savedTx;
    });

    // 4. Emit event cho report-service (AFTER transaction committed)
    this.reportClient.emit('transaction.created', {
      userId,
      transactionId: savedTx.id,
      after: {
        amount: savedTx.amount,
        category: savedTx.category,
        dateTime: savedTx.dateTime,
      },
    });

    return savedTx;
  }

  async updateTransaction(id: string, userId: string, data: TransactionEntity) {
    // Store old transaction data before starting transaction
    const oldTxData = await this.transactionRepository.findOne({
      where: { id, userId },
    });
    if (!oldTxData) throw new NotFoundException('Transaction not found');

    const updatedTx = await this.dataSource.transaction(async (manager) => {
      const txRepo = manager.getRepository(TransactionEntity);
      const accountRepo = manager.getRepository(AccountEntity);

      const oldTx = await txRepo.findOne({ where: { id, userId } });
      if (!oldTx) throw new NotFoundException('Transaction not found');

      const newTx = {
        ...oldTx,
        ...data,
      };
      const updatedTx = await txRepo.save(newTx);

      // 1. rollback old
      const oldDelta = this.getDelta(oldTx.category, oldTx.amount);
      // 2. apply new
      const newDelta = this.getDelta(updatedTx.category, updatedTx.amount);
      const totalDelta = newDelta - oldDelta;

      await accountRepo.update(
        { userId },
        { balance: () => `balance + ${totalDelta}` },
      );

      return updatedTx;
    });

    // Emit event AFTER transaction committed
    this.reportClient.emit('transaction.updated', {
      userId,
      transactionId: updatedTx.id,
      before: {
        amount: oldTxData.amount,
        category: oldTxData.category,
        dateTime: oldTxData.dateTime,
      },
      after: {
        amount: updatedTx.amount,
        category: updatedTx.category,
        dateTime: updatedTx.dateTime,
      },
    });

    return updatedTx;
  }

  /**
   * Delete transaction with user verification
   */
  async deleteWithUser(id: string, userId: string) {
    // Store transaction data before deletion
    const txToDelete = await this.transactionRepository.findOne({
      where: { id, userId },
    });
    if (!txToDelete) throw new NotFoundException('Transaction not found');

    await this.dataSource.transaction(async (manager) => {
      const txRepo = manager.getRepository(TransactionEntity);
      const accountRepo = manager.getRepository(AccountEntity);

      const tx = await txRepo.findOne({ where: { id, userId } });
      if (!tx) throw new NotFoundException('Transaction not found');

      await txRepo.remove(tx);

      // rollback lại
      const delta = this.getDelta(tx.category, tx.amount);
      await accountRepo.update(
        { userId },
        { balance: () => `balance - ${delta}` },
      );
    });

    // Emit event AFTER transaction committed
    this.reportClient.emit('transaction.deleted', {
      userId,
      transactionId: id,
      before: {
        amount: txToDelete.amount,
        category: txToDelete.category,
        dateTime: txToDelete.dateTime,
      },
    });

    return { message: 'Deleted successfully' };
  }

  async getAvailableMonthsByUser(userId: string): Promise<string[]> {
    try {
      // Get all distinct months from transactions FOR SPECIFIC USER
      const transactions = await this.transactionRepository
        .createQueryBuilder('transaction')
        .select('transaction.dateTime')
        .where('transaction.userId = :userId', { userId }) // Filter by userId
        .orderBy('transaction.dateTime', 'ASC')
        .getMany();

      // Extract unique months in MM/YYYY format
      const monthsSet = new Set<string>();

      transactions.forEach((transaction) => {
        const date = new Date(transaction.dateTime);
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const year = date.getFullYear().toString();
        monthsSet.add(`${month}/${year}`);
      });

      const months = Array.from(monthsSet);
      months.push('tương lai');

      return months;
    } catch (error) {
      throw new BadRequestException(
        `Failed to fetch available months: ${error.message}`,
      );
    }
  }
  /**
   * Get all transactions with full details for a specific user
   */
  async getTransactionsByUser(
    userId: string,
    monthYear?: string,
  ): Promise<TransactionEntity[]> {
    try {
      // Query transactions directly by userId
      const queryBuilder = this.transactionRepository
        .createQueryBuilder('transaction')
        .where('transaction.userId = :userId', { userId });

      // Apply month/year filter if provided
      if (monthYear) {
        if (monthYear.toLowerCase() === 'future') {
          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 1);
          tomorrow.setHours(0, 0, 0, 0);

          queryBuilder.andWhere('transaction.dateTime >= :tomorrow', {
            tomorrow,
          });
        } else {
          const parts = monthYear.split('/');
          if (parts.length === 2) {
            const month = parseInt(parts[0], 10);
            const year = parseInt(parts[1], 10);

            if (!isNaN(month) && !isNaN(year) && month >= 1 && month <= 12) {
              const startDate = new Date(year, month - 1, 1);
              const endDate = new Date(year, month, 0, 23, 59, 59, 999);

              queryBuilder
                .andWhere('transaction.dateTime >= :startDate', { startDate })
                .andWhere('transaction.dateTime <= :endDate', { endDate });
            }
          }
        }
      }

      queryBuilder.orderBy('transaction.dateTime', 'DESC');

      return await queryBuilder.getMany();
    } catch (error) {
      throw new BadRequestException(
        `Failed to fetch user transactions: ${error.message}`,
      );
    }
  }

  private async ensureAccount(userId: string, manager: EntityManager) {
    const accountRepo = manager.getRepository(AccountEntity);

    let acc = await accountRepo.findOne({ where: { userId } });
    if (!acc) {
      acc = accountRepo.create({
        userId,
        name: 'money', // default
        balance: 0,
      });
      await accountRepo.save(acc);
    }

    return acc;
  }

  /**
   * Analyze text and save transactions directly
   */
  async analyzeAndSaveTransactions(userId: string, text: string) {
    this.logger.log(`Analyzing and saving transactions for user ${userId}`);

    // Split text into sentences
    let rawSentences: string[] = [];
    const lines = text.split(/\r?\n/);
    const delimiterPattern =
      /[.。！!？?;；,，]+\s*|(?:\s+và\s+)|(?:\s+còn\s+)|(?:\s+rồi\s+)|(?:\s+nữa\s+)|(?:\s+thêm\s+)/gi;

    for (const line of lines) {
      if (line.trim().length > 0) {
        rawSentences.push(...line.split(delimiterPattern));
      }
    }
    rawSentences = rawSentences.map((s) => s.trim()).filter((s) => s.length > 0);

    // Analyze and save each transaction
    const savedTransactions: TransactionEntity[] = [];
    const now = new Date();

    for (const sentence of rawSentences) {
      const amount = this.amountExtractorService.extractAmount(sentence);

      if (amount > 0) {
        const category = await this.categoryPredictionService.predictCategory(
          sentence,
          amount,
        );

        const saved = await this.createTransaction(userId, {
          amount,
          category,
          note: sentence,
          dateTime: now,
          userId,
        } as TransactionEntity);

        savedTransactions.push(saved);
      }
    }

    return { transactions: savedTransactions };
  }

  async saveAnalyzedTransactions(
    userId: string,
    transactions: Array<{
      amount: number;
      category: string;
      note?: string;
      dateTime?: Date | string;
    }>,
  ) {
    this.logger.log(
      `Saving ${transactions.length} analyzed transactions for user ${userId}`,
    );

    const savedTransactions: TransactionEntity[] = [];
    const now = new Date();

    for (const tx of transactions) {
      const saved = await this.createTransaction(userId, {
        amount: Math.abs(tx.amount),
        category: tx.category,
        note: tx.note || '',
        dateTime: tx.dateTime ? new Date(tx.dateTime) : now,
        userId,
      } as TransactionEntity);

      savedTransactions.push(saved);
    }

    return { transactions: savedTransactions };
  }
}
