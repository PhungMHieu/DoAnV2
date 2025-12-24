import { BadRequestException, Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiQuery, ApiResponse } from '@nestjs/swagger';
import type { Request } from 'express';
import { GroupExpenseService } from './group-expense.service';
import { getUserIdFromRequest } from '@app/common/middleware/jwt-extract.middleware';
import { CreateExpenseDto, SplitType } from './dto';
import { MarkPaidDto } from './dto/mark-paid.dto';
import { GroupClientService } from './group-client.service';

@ApiTags('Group Expenses')
@Controller('groups/:groupId/expenses')
export class GroupExpenseController {
  constructor(
    private readonly groupExpenseService: GroupExpenseService,
    private readonly groupClientService: GroupClientService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a new expense in a group' })
  @ApiParam({ name: 'groupId', description: 'Group ID' })
  @ApiResponse({ status: 201, description: 'Expense created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request - validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Missing or invalid JWT token' })
  async createExpense(
    @Param('groupId') groupId: string,
    @Body() dto: CreateExpenseDto,
    @Req() req: Request,
  ) {
    const userId = getUserIdFromRequest(req);
    if (!userId) throw new BadRequestException('Missing or invalid JWT token');

    // Validate paidByMemberId is not empty after trim
    const paidByMemberId = dto.paidByMemberId.trim();
    if (!paidByMemberId) {
      throw new BadRequestException('paidByMemberId cannot be empty');
    }

    if (dto.splitType === SplitType.EQUAL) {
      // Validate participantMemberIds
      if (!dto.participantMemberIds || dto.participantMemberIds.length === 0) {
        throw new BadRequestException('participantMemberIds is required for equal split');
      }
      const participantMemberIds = dto.participantMemberIds.map((x) => x.trim()).filter((x) => x);
      if (participantMemberIds.length === 0) {
        throw new BadRequestException('participantMemberIds cannot contain only empty strings');
      }

      // Validate paidByMemberId is in participantMemberIds
      if (!participantMemberIds.includes(paidByMemberId)) {
        throw new BadRequestException('paidByMemberId must be included in participantMemberIds');
      }

      return this.groupExpenseService.createExpenseEqualSplit({
        groupId,
        title: dto.title.trim(),
        amount: dto.amount,
        paidByMemberId,
        participantMemberIds,
        createdByUserId: userId,
        category: dto.category,
      });
    }

    if (dto.splitType === SplitType.EXACT) {
      if (!dto.exactSplits || dto.exactSplits.length === 0) {
        throw new BadRequestException('exactSplits is required for exact split type');
      }

      // Validate paidByMemberId is in exactSplits
      const splitMemberIds = dto.exactSplits.map((s) => s.memberId.trim());
      if (!splitMemberIds.includes(paidByMemberId)) {
        throw new BadRequestException('paidByMemberId must be included in exactSplits');
      }

      return this.groupExpenseService.createExpenseExactSplit(
        groupId,
        {
          title: dto.title.trim(),
          amount: dto.amount,
          paidByMemberId,
          splitType: dto.splitType,
          splits: dto.exactSplits,
          category: dto.category,
        },
        userId,
      );
    }

    // PERCENT
    if (!dto.percentSplits || dto.percentSplits.length === 0) {
      throw new BadRequestException('percentSplits is required for percent split type');
    }

    // Validate paidByMemberId is in percentSplits
    const percentMemberIds = dto.percentSplits.map((s) => s.memberId.trim());
    if (!percentMemberIds.includes(paidByMemberId)) {
      throw new BadRequestException('paidByMemberId must be included in percentSplits');
    }

    return this.groupExpenseService.createExpensePercentSplit(
      groupId,
      {
        title: dto.title.trim(),
        amount: dto.amount,
        paidByMemberId,
        splitType: dto.splitType,
        splits: dto.percentSplits,
        category: dto.category,
      },
      userId,
    );
  }

  @Get()
  @ApiOperation({ summary: 'Get all expenses of a group' })
  @ApiParam({ name: 'groupId', description: 'Group ID' })
  @ApiResponse({ status: 200, description: 'List of expenses' })
  async getExpenses(@Param('groupId') groupId: string) {
    return this.groupExpenseService.getExpensesOfGroup(groupId);
  }

  @Get('my-debts')
  @ApiOperation({ summary: 'Get my debts in this group' })
  @ApiParam({ name: 'groupId', description: 'Group ID' })
  @ApiResponse({
    status: 200,
    description: 'List of debts for the current user',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          expenseId: { type: 'string', example: '123e4567-e89b-12d3-a456-426614174000' },
          expenseTitle: { type: 'string', example: 'Dinner at restaurant' },
          totalAmount: { type: 'string', example: '150.00' },
          myShare: { type: 'string', example: '50.00' },
          paidByMemberId: { type: 'string', example: '1' },
          createdAt: { type: 'string', format: 'date-time' },
          splitType: { type: 'string', enum: ['equal', 'exact', 'percent'] },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized - Missing or invalid JWT token' })
  @ApiResponse({ status: 404, description: 'Not found - User is not a member of this group' })
  async getMyDebts(@Param('groupId') groupId: string, @Req() req: Request) {
    const userId = getUserIdFromRequest(req);
    if (!userId) throw new BadRequestException('Missing or invalid JWT token');

    // Get member ID from group-service by passing the Authorization header
    const authHeader = req.headers.authorization || '';
    const memberId = await this.groupClientService.getMyMemberId(groupId, authHeader);

    // Get debts for this member
    return this.groupExpenseService.getMyDebts(groupId, String(memberId));
  }

  @Get('payment-history')
  @ApiOperation({
    summary: 'Get payment history (paid/received) for current user in a month',
    description: 'Returns list of payments made and received by current user in the specified month'
  })
  @ApiParam({ name: 'groupId', description: 'Group ID' })
  @ApiQuery({
    name: 'monthYear',
    required: true,
    description: 'Month and year in format MM/YYYY',
    example: '12/2025'
  })
  @ApiResponse({
    status: 200,
    description: 'Payment history',
    schema: {
      type: 'object',
      properties: {
        month: { type: 'string', example: '12/2025' },
        payments: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              date: { type: 'string', format: 'date-time' },
              type: { type: 'string', enum: ['paid', 'received'] },
              amount: { type: 'number', example: 300 },
              expenseTitle: { type: 'string', example: 'Dinner' },
              category: { type: 'string', example: 'food' },
              from: { type: 'string', example: 'Nam', description: 'Only for received type' },
              note: { type: 'string', example: 'Đã thanh toán cho nhóm' },
            },
          },
        },
        summary: {
          type: 'object',
          properties: {
            totalPaid: { type: 'number', example: 300 },
            totalReceived: { type: 'number', example: 200 },
            net: { type: 'number', example: -100, description: 'Positive = received more, Negative = paid more' },
          },
        },
      },
    },
  })
  async getPaymentHistory(
    @Param('groupId') groupId: string,
    @Query('monthYear') monthYear: string,
    @Req() req: Request
  ) {
    const userId = getUserIdFromRequest(req);
    if (!userId) throw new BadRequestException('Missing or invalid JWT token');

    if (!monthYear) {
      throw new BadRequestException('monthYear query parameter is required (format: MM/YYYY)');
    }

    // Get member ID from group-service
    const authHeader = req.headers.authorization || '';
    const memberId = await this.groupClientService.getMyMemberId(groupId, authHeader);

    return this.groupExpenseService.getPaymentHistory(groupId, String(memberId), monthYear);
  }

  @Post('mark-paid')
  @ApiOperation({
    summary: 'Mark a debt as paid (payer only)',
    description: 'Marks a share as paid and creates settlement transactions for both payer and debtor'
  })
  @ApiParam({ name: 'groupId', description: 'Group ID' })
  @ApiResponse({
    status: 200,
    description: 'Debt marked as paid successfully',
  })
  @ApiResponse({ status: 403, description: 'Only payer can mark as paid' })
  @ApiResponse({ status: 400, description: 'Already paid or invalid share' })
  async markPaid(
    @Param('groupId') groupId: string,
    @Body() dto: MarkPaidDto,
    @Req() req: Request,
  ) {
    const userId = getUserIdFromRequest(req);
    if (!userId) throw new BadRequestException('Missing or invalid JWT token');

    const authHeader = req.headers.authorization || '';
    const memberId = await this.groupClientService.getMyMemberId(groupId, authHeader);

    return this.groupExpenseService.markShareAsPaid(dto.shareId, memberId, groupId);
  }

  @Get('owed-to-me')
  @ApiOperation({
    summary: 'Get list of unpaid debts owed to me',
    description: 'Returns all unpaid shares from expenses where current user is the payer'
  })
  @ApiParam({ name: 'groupId', description: 'Group ID' })
  @ApiResponse({
    status: 200,
    description: 'List of people who owe me money',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          shareId: { type: 'string', example: '123e4567-e89b-12d3-a456-426614174000' },
          expenseId: { type: 'string', example: '123e4567-e89b-12d3-a456-426614174000' },
          expenseTitle: { type: 'string', example: 'Dinner at restaurant' },
          totalAmount: { type: 'string', example: '150.00' },
          shareAmount: { type: 'string', example: '50.00' },
          debtorMemberId: { type: 'string', example: '2' },
          createdAt: { type: 'string', format: 'date-time' },
          isPaid: { type: 'boolean', example: false },
        },
      },
    },
  })
  async getOwedToMe(@Param('groupId') groupId: string, @Req() req: Request) {
    const userId = getUserIdFromRequest(req);
    if (!userId) throw new BadRequestException('Missing or invalid JWT token');

    const authHeader = req.headers.authorization || '';
    const memberId = await this.groupClientService.getMyMemberId(groupId, authHeader);

    return this.groupExpenseService.getOwedToMe(groupId, String(memberId));
  }
}
