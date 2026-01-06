import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiParam,
  ApiBearerAuth,
  ApiBody,
} from '@nestjs/swagger';
import { TransactionServiceService } from './transaction-service.service';
import { TransactionEntity } from './entities/transaction.entity';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { getUserIdFromRequest } from '@app/common/middleware/jwt-extract.middleware';

@ApiTags('Transactions')
@ApiBearerAuth('access-token')
@Controller()
export class TransactionServiceController {
  constructor(
    private readonly transactionServiceService: TransactionServiceService,
  ) {}
  @Get('months')
  @ApiOperation({
    summary: 'Get available months',
    description: 'Retrieves list of months that have transactions for the user',
  })
  @ApiResponse({
    status: 200,
    description: 'Available months retrieved successfully',
    schema: {
      type: 'array',
      items: { type: 'string' },
      example: ['12/2024', '11/2024', '10/2024'],
    },
  })
  @ApiResponse({ status: 401, description: 'Missing x-user-id header' })
  async getAvailableMonths(@Req() req): Promise<string[]> {
    const userId = getUserIdFromRequest(req); // 👈 lấy trực tiếp từ token

    if (!userId) {
      throw new UnauthorizedException('Missing or invalid JWT token');
    }

    return await this.transactionServiceService.getAvailableMonthsByUser(
      userId,
    );
  }

  @Get()
  @ApiOperation({
    summary: 'Get transactions',
    description:
      'Retrieves all transactions for the user, optionally filtered by month/year',
  })
  @ApiQuery({
    name: 'monthYear',
    description: 'Filter by month and year in MM/YYYY format',
    example: '12/2024',
    required: false,
  })
  @ApiResponse({
    status: 200,
    description: 'Transactions retrieved successfully',
    type: [TransactionEntity],
  })
  @ApiResponse({ status: 401, description: 'Missing x-user-id header' })
  async findAll(
    @Req() req: Request,
    @Query('monthYear') monthYear?: string,
  ): Promise<TransactionEntity[]> {
    // Lấy userId trực tiếp từ JWT token
    const userId = getUserIdFromRequest(req);

    if (!userId) {
      throw new UnauthorizedException('Missing or invalid JWT token');
    }

    // Chỉ trả về transaction của đúng user đó
    return this.transactionServiceService.getTransactionsByUser(
      userId,
      monthYear,
    );
  }

  // 🟩 Thêm mới transaction
  @Post()
  @ApiOperation({
    summary: 'Create transaction',
    description:
      'Creates a new transaction for the user.\n\n' +
      '**AI Amount Extraction behavior:**\n' +
      "- If `amount` IS provided → Uses user's value (extraction will NOT run)\n" +
      '- If `amount` is NOT provided BUT `note` exists → AI extracts amount from Vietnamese text\n' +
      '- Supports: plain numbers (50000), k notation (50k), Vietnamese words (50 nghìn, 1.5 triệu)\n' +
      '- If extraction fails → Defaults to 0\n\n' +
      '**AI Auto-categorization behavior:**\n' +
      "- If `category` IS provided → Uses user's choice (AI will NOT override)\n" +
      '- If `category` is NOT provided BUT `note` exists → AI auto-predicts category\n' +
      '- If both missing → Defaults to "other"\n\n' +
      '**Examples:**\n' +
      '1. Text-only input: `{note: "ăn phở 50k", type: "EXPENSE", dateTime: "..."}` → Extracts amount: 50000, predicts category: "food"\n' +
      '2. User provides amount: `{amount: 50000, note: "lunch", type: "EXPENSE"}` → Uses 50000, predicts category\n' +
      '3. User provides both: `{amount: 50000, category: "food", note: "lunch"}` → Uses both user values',
  })
  @ApiBody({
    description:
      'Transaction data. Amount and category are optional - AI will extract/predict if not provided.',
    type: CreateTransactionDto,
  })
  @ApiResponse({
    status: 201,
    description: 'Transaction created successfully',
    type: TransactionEntity,
  })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT token' })
  async create(
    @Req() req: Request,
    @Body() body: CreateTransactionDto,
  ): Promise<TransactionEntity> {
    const userId = getUserIdFromRequest(req);

    if (!userId) {
      throw new UnauthorizedException('Missing or invalid JWT token');
    }

    // Validate amount exists
    if (body.amount === undefined || body.amount === null) {
      body.amount = 0;
    }

    // Set default category if not provided
    if (!body.category) {
      body.category = 'Other';
    }

    // Tạo transaction entity từ DTO
    const transaction: TransactionEntity = {
      amount: body.amount,
      category: body.category,
      note: body.note,
      dateTime: body.dateTime,
      userId, // Được gán từ JWT token
    } as TransactionEntity;

    return this.transactionServiceService.createTransaction(
      userId,
      transaction,
    );
  }

  // 🟨 Sửa transaction theo id
  @Patch(':id')
  @ApiOperation({
    summary: 'Update transaction',
    description: 'Updates an existing transaction by ID',
  })
  @ApiParam({
    name: 'id',
    description: 'Transaction ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiBody({
    description: 'Partial transaction data to update',
    schema: {
      type: 'object',
      properties: {
        amount: { type: 'number', example: 60000 },
        category: { type: 'string', example: 'transport' },
        note: { type: 'string', example: 'Updated note' },
        dateTime: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Transaction updated successfully',
    type: TransactionEntity,
  })
  @ApiResponse({ status: 401, description: 'Missing x-user-id header' })
  @ApiResponse({ status: 404, description: 'Transaction not found' })
  async update(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: Partial<TransactionEntity>, // cho phép update một phần
  ): Promise<TransactionEntity> {
    const userId = getUserIdFromRequest(req);

    if (!userId) {
      throw new UnauthorizedException('Missing or invalid JWT token');
    }

    return this.transactionServiceService.updateTransaction(
      id,
      userId,
      body as TransactionEntity,
    );
  }

  // 🟥 Xoá transaction theo id
  @Delete(':id')
  @ApiOperation({
    summary: 'Delete transaction',
    description: 'Deletes an existing transaction by ID',
  })
  @ApiParam({
    name: 'id',
    description: 'Transaction ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'Transaction deleted successfully',
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          example: 'Transaction deleted successfully',
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Missing x-user-id header' })
  @ApiResponse({ status: 404, description: 'Transaction not found' })
  async remove(
    @Req() req: Request,
    @Param('id') id: string,
  ): Promise<{ message: string }> {
    const userId = getUserIdFromRequest(req);

    if (!userId) {
      throw new UnauthorizedException('Missing or invalid JWT token');
    }

    return this.transactionServiceService.deleteWithUser(id, userId);
  }

  @Post('analyze-and-save')
  @ApiOperation({
    summary: 'Analyze Vietnamese text and save transactions',
    description:
      'Parses Vietnamese text, extracts amounts, predicts categories, and saves transactions directly.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['text'],
      properties: {
        text: {
          type: 'string',
          example: 'mua tạp dề 50k. ăn phở 90k và cafe 35k',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Transactions created successfully',
    type: [TransactionEntity],
  })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT token' })
  async analyzeAndSave(
    @Req() req: Request,
    @Body('text') text: string,
  ) {
    const userId = getUserIdFromRequest(req);
    if (!userId) {
      throw new UnauthorizedException('Missing or invalid JWT token');
    }

    return this.transactionServiceService.analyzeAndSaveTransactions(
      userId,
      text,
    );
  }

  @Post('save-analyzed-transactions')
  @ApiOperation({
    summary: 'Save pre-analyzed transactions',
    description:
      'Saves transactions that have already been analyzed by the client (amount and category provided).',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['transactions'],
      properties: {
        transactions: {
          type: 'array',
          items: {
            type: 'object',
            required: ['amount', 'category'],
            properties: {
              amount: { type: 'number', example: 50000 },
              category: { type: 'string', example: 'food' },
              note: { type: 'string', example: 'ăn phở' },
              dateTime: {
                type: 'string',
                format: 'date-time',
                example: '2025-01-04T12:00:00Z',
              },
            },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Transactions saved successfully',
  })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT token' })
  async saveAnalyzedTransactions(
    @Req() req: Request,
    @Body('transactions')
    transactions: Array<{
      amount: number;
      category: string;
      note?: string;
      dateTime?: string;
    }>,
  ) {
    const userId = getUserIdFromRequest(req);
    if (!userId) {
      throw new UnauthorizedException('Missing or invalid JWT token');
    }

    if (!transactions || !Array.isArray(transactions) || transactions.length === 0) {
      throw new BadRequestException('transactions array is required');
    }

    return this.transactionServiceService.saveAnalyzedTransactions(
      userId,
      transactions,
    );
  }
}
