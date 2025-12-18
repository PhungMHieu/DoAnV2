import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UnauthorizedException } from '@nestjs/common';
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

@ApiTags('Transactions')
@ApiBearerAuth('access-token')
@Controller()
export class TransactionServiceController {
  constructor(private readonly transactionServiceService: TransactionServiceService) {}
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
    const userId = req.headers['x-user-id']; // 👈 lấy id từ header

    if (!userId) {
      throw new UnauthorizedException('Missing x-user-id header');
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
    // Lấy userId từ header do API Gateway gắn vào
    const userId = req.headers['x-user-id'] as string;

    if (!userId) {
      throw new UnauthorizedException('Missing x-user-id header');
    }

    // Chỉ trả về transaction của đúng user đó
    return this.transactionServiceService.getTransactionsByUser(userId, monthYear);
  }

  // 🟩 Thêm mới transaction
  @Post()
  @ApiOperation({ 
    summary: 'Create transaction',
    description: 'Creates a new transaction for the user'
  })
  @ApiBody({
    description: 'Transaction data',
    type: TransactionEntity,
    schema: {
      type: 'object',
      properties: {
        amount: { type: 'number', example: 50000 },
        category: { type: 'string', example: 'food' },
        note: { type: 'string', example: 'Lunch with colleagues' },
        dateTime: { type: 'string', format: 'date-time', example: '2024-12-09T12:00:00Z' }
      },
      required: ['amount', 'category', 'dateTime']
    }
  })
  @ApiResponse({
    status: 201,
    description: 'Transaction created successfully',
    type: TransactionEntity
  })
  @ApiResponse({ status: 401, description: 'Missing x-user-id header' })
  async create(
    @Req() req: Request,
    @Body() body: TransactionEntity, // không dùng DTO nên nhận luôn entity
  ): Promise<TransactionEntity> {
    const userId = req.headers['x-user-id'] as string;

    if (!userId) {
      throw new UnauthorizedException('Missing x-user-id header');
    }

    // service sẽ tự gán userId vào entity trước khi save
    return this.transactionServiceService.createTransaction(userId, body);
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
    const userId = req.headers['x-user-id'] as string;

    if (!userId) {
      throw new UnauthorizedException('Missing x-user-id header');
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
    const userId = req.headers['x-user-id'] as string;

    if (!userId) {
      throw new UnauthorizedException('Missing x-user-id header');
    }

    return this.transactionServiceService.deleteWithUser(id, userId);
  }
}
