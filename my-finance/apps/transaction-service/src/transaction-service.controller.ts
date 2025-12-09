import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UnauthorizedException } from '@nestjs/common';
import { TransactionServiceService } from './transaction-service.service';
import { TransactionEntity } from './entities/transaction.entity';

@Controller()
export class TransactionServiceController {
  constructor(private readonly transactionServiceService: TransactionServiceService) {}
  @Get('months')
  async getAvailableMonths(@Req() req): Promise<string[]> {
    const userId = req.headers['x-user-id']; // 👈 lấy id từ header

    if (!userId) {
      throw new UnauthorizedException('Missing x-user-id header');
    }

    return await this.transactionServiceService.getAvailableMonthsByUser(userId);
  }

  @Get()
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
