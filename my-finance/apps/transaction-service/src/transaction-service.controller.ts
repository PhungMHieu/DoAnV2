import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiParam,
  ApiBearerAuth,
  ApiBody
} from '@nestjs/swagger';
import { TransactionServiceService } from './transaction-service.service';
import { TransactionEntity } from './entities/transaction.entity';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { getUserIdFromRequest } from '@app/common/middleware/jwt-extract.middleware';
import { MlClientService } from './ml-client/ml-client.service';

@ApiTags('Transactions')
@ApiBearerAuth('access-token')
@Controller()
export class TransactionServiceController {
  constructor(
    private readonly transactionServiceService: TransactionServiceService,
    private readonly mlClientService: MlClientService,
  ) {}
  @Get('months')
  @ApiOperation({ 
    summary: 'Get available months',
    description: 'Retrieves list of months that have transactions for the user'
  })
  @ApiResponse({
    status: 200,
    description: 'Available months retrieved successfully',
    schema: {
      type: 'array',
      items: { type: 'string' },
      example: ['12/2024', '11/2024', '10/2024']
    }
  })
  @ApiResponse({ status: 401, description: 'Missing x-user-id header' })
  async getAvailableMonths(@Req() req): Promise<string[]> {
    const userId = getUserIdFromRequest(req); // 👈 lấy trực tiếp từ token

    if (!userId) {
      throw new UnauthorizedException('Missing or invalid JWT token');
    }

    return await this.transactionServiceService.getAvailableMonthsByUser(userId);
  }

  @Get()
  @ApiOperation({ 
    summary: 'Get transactions',
    description: 'Retrieves all transactions for the user, optionally filtered by month/year'
  })
  @ApiQuery({
    name: 'monthYear',
    description: 'Filter by month and year in MM/YYYY format',
    example: '12/2024',
    required: false
  })
  @ApiResponse({
    status: 200,
    description: 'Transactions retrieved successfully',
    type: [TransactionEntity]
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
    return this.transactionServiceService.getTransactionsByUser(userId, monthYear);
  }

  // 🟩 Thêm mới transaction
  @Post()
  @ApiOperation({
    summary: 'Create transaction',
    description:
      'Creates a new transaction for the user.\n\n' +
      '**AI Amount Extraction behavior:**\n' +
      '- If `amount` IS provided → Uses user\'s value (extraction will NOT run)\n' +
      '- If `amount` is NOT provided BUT `note` exists → AI extracts amount from Vietnamese text\n' +
      '- Supports: plain numbers (50000), k notation (50k), Vietnamese words (50 nghìn, 1.5 triệu)\n' +
      '- If extraction fails → Defaults to 0\n\n' +
      '**AI Auto-categorization behavior:**\n' +
      '- If `category` IS provided → Uses user\'s choice (AI will NOT override)\n' +
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

    // 🔢 Amount Extraction Logic:
    // Extract amount from Vietnamese text if not provided
    if (!body.amount && body.note && body.note.trim().length > 0) {
      try {
        const extraction = await this.mlClientService.extractAmount(body.note);

        if (extraction.amount > 0) {
          body.amount = extraction.amount;
          console.log(
            `[Amount Extraction] ✅ Extracted ${extraction.amount} from: "${body.note}" (method: ${extraction.method}, confidence: ${(extraction.confidence * 100).toFixed(1)}%)`,
          );
        } else {
          // Fallback to 0 when extraction fails
          body.amount = 0;
          console.log(
            `[Amount Extraction] ⚠️  No amount found in: "${body.note}", using default 0`,
          );
        }
      } catch (error) {
        console.error('[Amount Extraction] ❌ Failed:', error.message);
        body.amount = 0; // Fallback
      }
    }

    // Validate amount exists after extraction
    if (body.amount === undefined || body.amount === null) {
      body.amount = 0;
      console.log('[Amount Extraction] Using default amount: 0');
    }

    // 🤖 AI Auto-categorization Logic:
    // CRITICAL: Chỉ gọi AI nếu user KHÔNG tự chọn category
    // → Tôn trọng lựa chọn của người dùng!
    if (!body.category && body.note && body.note.trim().length > 0) {
      try {
        const prediction = await this.mlClientService.predictCategory(
          body.note,
          body.amount,
        );

        // Chỉ auto-fill nếu confidence đủ cao (≥ 0.5)
        if (prediction.confidence >= 0.5) {
          body.category = prediction.category;
          console.log(
            `[AI Auto-categorization] ✅ Predicted "${prediction.category}" with ${(prediction.confidence * 100).toFixed(1)}% confidence for: "${body.note}"`,
          );
        } else {
          // Confidence thấp → fallback
          body.category = 'other';
          console.log(
            `[AI Auto-categorization] ⚠️  Low confidence (${(prediction.confidence * 100).toFixed(1)}%), using fallback "other"`,
          );
        }
      } catch (error) {
        // Nếu ML service fail → fallback
        console.error('[AI Auto-categorization] ❌ Failed:', error.message);
        body.category = 'other';
      }
    } else if (body.category) {
      // User đã chọn category → KHÔNG override
      console.log(
        `[User choice] 👤 User manually selected category: "${body.category}"`,
      );
    }

    // Final fallback nếu vẫn không có category
    if (!body.category) {
      body.category = 'other';
      console.log('[Default fallback] Using "other" category');
    }

    // Tạo transaction entity từ DTO
    const transaction: TransactionEntity = {
      amount: body.amount,
      category: body.category,
      note: body.note,
      dateTime: body.dateTime,
      userId, // Được gán từ JWT token
    } as TransactionEntity;

    return this.transactionServiceService.createTransaction(userId, transaction);
  }

  // 🟨 Sửa transaction theo id
  @Patch(':id')
  @ApiOperation({ 
    summary: 'Update transaction',
    description: 'Updates an existing transaction by ID'
  })
  @ApiParam({
    name: 'id',
    description: 'Transaction ID',
    example: '123e4567-e89b-12d3-a456-426614174000'
  })
  @ApiBody({
    description: 'Partial transaction data to update',
    schema: {
      type: 'object',
      properties: {
        amount: { type: 'number', example: 60000 },
        category: { type: 'string', example: 'transport' },
        note: { type: 'string', example: 'Updated note' },
        dateTime: { type: 'string', format: 'date-time' }
      }
    }
  })
  @ApiResponse({
    status: 200,
    description: 'Transaction updated successfully',
    type: TransactionEntity
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

    return this.transactionServiceService.updateTransaction(id, userId, body as TransactionEntity);
  }

  // 🟥 Xoá transaction theo id
  @Delete(':id')
  @ApiOperation({ 
    summary: 'Delete transaction',
    description: 'Deletes an existing transaction by ID'
  })
  @ApiParam({
    name: 'id',
    description: 'Transaction ID',
    example: '123e4567-e89b-12d3-a456-426614174000'
  })
  @ApiResponse({
    status: 200,
    description: 'Transaction deleted successfully',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Transaction deleted successfully' }
      }
    }
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

  // 🤖 AI-powered category prediction
  @Post('predict-category')
  @ApiOperation({
    summary: 'Predict transaction category using AI',
    description: 'Uses machine learning to predict the most suitable category based on transaction description',
  })
  @ApiBody({
    description: 'Transaction details for prediction',
    schema: {
      type: 'object',
      properties: {
        note: { type: 'string', example: 'Mua cơm trưa quán Phở 24' },
        amount: { type: 'number', example: 50000 },
      },
      required: ['note'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Category predicted successfully',
    schema: {
      type: 'object',
      properties: {
        category: { type: 'string', example: 'food' },
        confidence: { type: 'number', example: 0.85 },
        suggestions: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              category: { type: 'string', example: 'food' },
              confidence: { type: 'number', example: 0.85 },
            },
          },
          example: [
            { category: 'food', confidence: 0.85 },
            { category: 'entertainment', confidence: 0.10 },
            { category: 'other', confidence: 0.05 },
          ],
        },
        model: { type: 'string', example: 'keyword-matcher-v1' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  async predictCategory(
    @Body() body: { note: string; amount?: number },
  ): Promise<{
    category: string;
    confidence: number;
    suggestions: Array<{ category: string; confidence: number }>;
    model: string;
  }> {
    return this.mlClientService.predictCategory(body.note, body.amount);
  }
}
