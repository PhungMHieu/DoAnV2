import { BadRequestException, Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';
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

      return this.groupExpenseService.createExpenseEqualSplit({
        groupId,
        title: dto.title.trim(),
        amount: dto.amount,
        paidByMemberId,
        participantMemberIds,
        createdByUserId: userId,
      });
    }

    if (dto.splitType === SplitType.EXACT) {
      if (!dto.exactSplits || dto.exactSplits.length === 0) {
        throw new BadRequestException('exactSplits is required for exact split type');
      }
      return this.groupExpenseService.createExpenseExactSplit(
        groupId,
        {
          title: dto.title.trim(),
          amount: dto.amount,
          paidByMemberId,
          splitType: dto.splitType,
          splits: dto.exactSplits,
        },
        userId,
      );
    }

    // PERCENT
    if (!dto.percentSplits || dto.percentSplits.length === 0) {
      throw new BadRequestException('percentSplits is required for percent split type');
    }
    return this.groupExpenseService.createExpensePercentSplit(
      groupId,
      {
        title: dto.title.trim(),
        amount: dto.amount,
        paidByMemberId,
        splitType: dto.splitType,
        splits: dto.percentSplits,
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
