import { BadRequestException, Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiBody, ApiResponse } from '@nestjs/swagger';
import type { Request } from 'express';
import { GroupExpenseService } from './group-expense.service';

@ApiTags('Group Expenses')
@Controller('groups/:groupId/expenses')
export class GroupExpenseController {
  constructor(private readonly groupExpenseService: GroupExpenseService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new expense in a group' })
  @ApiParam({ name: 'groupId', description: 'Group ID' })
  @ApiBody({
    description: 'Expense data',
    schema: {
      type: 'object',
      required: ['title', 'amount', 'paidByMemberId', 'splitType'],
      properties: {
        title: { type: 'string', example: 'Dinner' },
        amount: { type: 'number', example: 500000 },
        paidByMemberId: { type: 'string', example: 'member-uuid' },
        splitType: { type: 'string', enum: ['equal', 'exact', 'percent'], example: 'equal' },
        participantMemberIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'Required for equal split',
          example: ['member-1', 'member-2'],
        },
        splits: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              memberId: { type: 'string' },
              amount: { type: 'number', description: 'For exact split' },
              percent: { type: 'number', description: 'For percent split' },
            },
          },
          description: 'Required for exact/percent split',
        },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Expense created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request - validation error' })
  async createExpense(
    @Param('groupId') groupId: string,
    @Body() body: any,
    @Req() req: Request,
  ) {
    const userId = req.headers['x-user-id'] as string;

    const title = body?.title;
    const amount = body?.amount;
    const paidByMemberId = body?.paidByMemberId;
    const splitType = body?.splitType;

    if (typeof title !== 'string' || !title.trim()) {
      throw new BadRequestException('title is required');
    }
    if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException('amount must be a positive number');
    }
    if (typeof paidByMemberId !== 'string' || !paidByMemberId.trim()) {
      throw new BadRequestException('paidByMemberId is required');
    }
    if (!['equal', 'exact', 'percent'].includes(splitType)) {
      throw new BadRequestException('splitType must be one of: equal, exact, percent');
    }

    if (splitType === 'equal') {
      const participantMemberIds = body?.participantMemberIds;
      if (!Array.isArray(participantMemberIds) || participantMemberIds.length === 0) {
        throw new BadRequestException('participantMemberIds must be non-empty array for equal split');
      }
      if (participantMemberIds.some((x) => typeof x !== 'string' || !x.trim())) {
        throw new BadRequestException('participantMemberIds must be array of non-empty strings');
      }

      return this.groupExpenseService.createExpenseEqualSplit({
        groupId,
        title: title.trim(),
        amount,
        paidByMemberId: paidByMemberId.trim(),
        participantMemberIds: participantMemberIds.map((x) => x.trim()),
        createdByUserId: userId,
      });
    }

    // exact / percent
    const splits = body?.splits;
    if (!Array.isArray(splits) || splits.length === 0) {
      throw new BadRequestException('splits must be non-empty array for exact/percent');
    }
    if (splits.some((s) => typeof s?.memberId !== 'string' || !s.memberId.trim())) {
      throw new BadRequestException('each split must have memberId');
    }

    if (splitType === 'exact') {
      return this.groupExpenseService.createExpenseExactSplit(groupId, body, userId);
    }

    return this.groupExpenseService.createExpensePercentSplit(groupId, body, userId);
  }

  @Get()
  @ApiOperation({ summary: 'Get all expenses of a group' })
  @ApiParam({ name: 'groupId', description: 'Group ID' })
  @ApiResponse({ status: 200, description: 'List of expenses' })
  async getExpenses(@Param('groupId') groupId: string) {
    return this.groupExpenseService.getExpensesOfGroup(groupId);
  }
}
