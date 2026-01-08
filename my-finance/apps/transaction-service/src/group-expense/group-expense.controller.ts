import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { GroupExpenseService } from './group-expense.service';
import { getUserIdFromRequest } from '@app/common/middleware/jwt-extract.middleware';
import { CreateExpenseDto, SplitType, UploadProofDto } from './dto';
import { MarkPaidDto } from './dto/mark-paid.dto';
import { GroupClientService } from './group-client.service';
import 'multer';

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
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Missing or invalid JWT token',
  })
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

    // Parse transactions from DTO
    const transactions = dto.transactions.map((tx) => ({
      amount: tx.amount,
      category: tx.category,
      note: tx.note,
      dateTime: tx.dateTime ? new Date(tx.dateTime) : undefined,
    }));

    if (dto.splitType === SplitType.EQUAL) {
      // Validate participants
      if (!dto.participants || dto.participants.length === 0) {
        throw new BadRequestException(
          'participants is required for equal split',
        );
      }

      // Validate paidByMemberId is in participants
      const participantMemberIds = dto.participants.map((p) => p.memberId);
      if (!participantMemberIds.includes(paidByMemberId)) {
        throw new BadRequestException(
          'paidByMemberId must be included in participants',
        );
      }

      return this.groupExpenseService.createExpenseEqualSplit({
        groupId,
        title: dto.title.trim(),
        transactions,
        paidByMemberId,
        paidByUserId: dto.paidByUserId,
        paidByMemberName: dto.paidByMemberName,
        participants: dto.participants,
        createdByUserId: userId,
        date: dto.date,
      });
    }

    if (dto.splitType === SplitType.EXACT) {
      if (!dto.exactSplits || dto.exactSplits.length === 0) {
        throw new BadRequestException(
          'exactSplits is required for exact split type',
        );
      }

      // Validate paidByMemberId is in exactSplits
      const splitMemberIds = dto.exactSplits.map((s) => s.memberId);
      if (!splitMemberIds.includes(paidByMemberId)) {
        throw new BadRequestException(
          'paidByMemberId must be included in exactSplits',
        );
      }

      return this.groupExpenseService.createExpenseExactSplit(
        groupId,
        {
          title: dto.title.trim(),
          transactions,
          paidByMemberId,
          paidByUserId: dto.paidByUserId,
          paidByMemberName: dto.paidByMemberName,
          exactSplits: dto.exactSplits,
          date: dto.date,
        },
        userId,
      );
    }

    // PERCENT
    if (!dto.percentSplits || dto.percentSplits.length === 0) {
      throw new BadRequestException(
        'percentSplits is required for percent split type',
      );
    }

    // Validate paidByMemberId is in percentSplits
    const percentMemberIds = dto.percentSplits.map((s) => s.memberId);
    if (!percentMemberIds.includes(paidByMemberId)) {
      throw new BadRequestException(
        'paidByMemberId must be included in percentSplits',
      );
    }

    return this.groupExpenseService.createExpensePercentSplit(
      groupId,
      {
        title: dto.title.trim(),
        transactions,
        paidByMemberId,
        paidByUserId: dto.paidByUserId,
        paidByMemberName: dto.paidByMemberName,
        percentSplits: dto.percentSplits,
        date: dto.date,
      },
      userId,
    );
  }

  @Get()
  @ApiOperation({ summary: 'Get all expenses of a group' })
  @ApiParam({ name: 'groupId', description: 'Group ID' })
  @ApiResponse({
    status: 200,
    description: 'List of expenses with transactions',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          title: { type: 'string', example: 'Dinner at restaurant' },
          groupId: { type: 'string', format: 'uuid' },
          paidByMemberId: { type: 'string' },
          paidByMemberName: { type: 'string' },
          splitType: { type: 'string', enum: ['equal', 'exact', 'percent'] },
          createdAt: { type: 'string', format: 'date-time' },
          totalAmount: { type: 'number', example: 250000 },
          transactions: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string', format: 'uuid' },
                amount: { type: 'number', example: 200000 },
                category: { type: 'string', example: 'food' },
                note: { type: 'string', example: 'Main course' },
                dateTime: { type: 'string', format: 'date-time' },
              },
            },
          },
          shares: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string', format: 'uuid' },
                memberId: { type: 'string' },
                memberName: { type: 'string' },
                amount: { type: 'string', example: '83333.33' },
                isPaid: { type: 'boolean' },
              },
            },
          },
        },
      },
    },
  })
  async getExpenses(@Param('groupId') groupId: string) {
    return this.groupExpenseService.getExpensesOfGroup(groupId);
  }

  @Get('my-expenses')
  @ApiOperation({
    summary: 'Get my expenses in this group',
    description:
      'Returns all expenses where the current user is involved (as payer or participant)',
  })
  @ApiParam({ name: 'groupId', description: 'Group ID' })
  @ApiResponse({
    status: 200,
    description: 'List of expenses for the current user',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          title: { type: 'string', example: 'Dinner at restaurant' },
          groupId: { type: 'string', format: 'uuid' },
          paidByMemberId: { type: 'string' },
          paidByMemberName: { type: 'string' },
          splitType: { type: 'string', enum: ['equal', 'exact', 'percent'] },
          createdAt: { type: 'string', format: 'date-time' },
          totalAmount: { type: 'number', example: 250000 },
          transactions: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string', format: 'uuid' },
                amount: { type: 'number', example: 200000 },
                category: { type: 'string', example: 'food' },
                note: { type: 'string', example: 'Main course' },
                dateTime: { type: 'string', format: 'date-time' },
              },
            },
          },
          shares: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string', format: 'uuid' },
                memberId: { type: 'string' },
                memberName: { type: 'string' },
                amount: { type: 'string', example: '83333.33' },
                isPaid: { type: 'boolean' },
              },
            },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Missing or invalid JWT token',
  })
  async getMyExpenses(@Param('groupId') groupId: string, @Req() req: Request) {
    const userId = getUserIdFromRequest(req);
    if (!userId) throw new BadRequestException('Missing or invalid JWT token');

    const authHeader = req.headers.authorization || '';
    const memberId = await this.groupClientService.getMyMemberId(
      groupId,
      authHeader,
    );

    return this.groupExpenseService.getMyExpenses(groupId, String(memberId));
  }

  @Get(':expenseId')
  @ApiOperation({ summary: 'Get expense detail by ID' })
  @ApiParam({ name: 'groupId', description: 'Group ID' })
  @ApiParam({ name: 'expenseId', description: 'Expense ID' })
  @ApiResponse({
    status: 200,
    description: 'Expense detail with transactions',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        title: { type: 'string', example: 'Dinner at restaurant' },
        groupId: { type: 'string', format: 'uuid' },
        paidByMemberId: { type: 'string' },
        paidByMemberName: { type: 'string' },
        splitType: { type: 'string', enum: ['equal', 'exact', 'percent'] },
        createdAt: { type: 'string', format: 'date-time' },
        totalAmount: { type: 'number', example: 250000 },
        transactions: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              amount: { type: 'number', example: 200000 },
              category: { type: 'string', example: 'food' },
              note: { type: 'string', example: 'Main course' },
              dateTime: { type: 'string', format: 'date-time' },
            },
          },
        },
        shares: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              memberId: { type: 'string' },
              memberName: { type: 'string' },
              amount: { type: 'string', example: '83333.33' },
              isPaid: { type: 'boolean' },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Expense not found' })
  async getExpenseDetail(
    @Param('groupId') groupId: string,
    @Param('expenseId') expenseId: string,
  ) {
    return this.groupExpenseService.getExpenseDetail(groupId, expenseId);
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
          expenseId: {
            type: 'string',
            example: '123e4567-e89b-12d3-a456-426614174000',
          },
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
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Missing or invalid JWT token',
  })
  @ApiResponse({
    status: 404,
    description: 'Not found - User is not a member of this group',
  })
  async getMyDebts(@Param('groupId') groupId: string, @Req() req: Request) {
    const userId = getUserIdFromRequest(req);
    if (!userId) throw new BadRequestException('Missing or invalid JWT token');

    // Get member ID from group-service by passing the Authorization header
    const authHeader = req.headers.authorization || '';
    const memberId = await this.groupClientService.getMyMemberId(
      groupId,
      authHeader,
    );

    // Get debts for this member
    return this.groupExpenseService.getMyDebts(groupId, String(memberId));
  }

  @Get('payment-history')
  @ApiOperation({
    summary: 'Get payment history (paid/received) for current user in a month',
    description:
      'Returns list of payments made and received by current user in the specified month',
  })
  @ApiParam({ name: 'groupId', description: 'Group ID' })
  @ApiQuery({
    name: 'monthYear',
    required: true,
    description: 'Month and year in format MM/YYYY',
    example: '12/2025',
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
              from: {
                type: 'string',
                example: 'Nam',
                description: 'Only for received type',
              },
              note: { type: 'string', example: 'Đã thanh toán cho nhóm' },
            },
          },
        },
        summary: {
          type: 'object',
          properties: {
            totalPaid: { type: 'number', example: 300 },
            totalReceived: { type: 'number', example: 200 },
            net: {
              type: 'number',
              example: -100,
              description: 'Positive = received more, Negative = paid more',
            },
          },
        },
      },
    },
  })
  async getPaymentHistory(
    @Param('groupId') groupId: string,
    @Query('monthYear') monthYear: string,
    @Req() req: Request,
  ) {
    const userId = getUserIdFromRequest(req);
    if (!userId) throw new BadRequestException('Missing or invalid JWT token');

    if (!monthYear) {
      throw new BadRequestException(
        'monthYear query parameter is required (format: MM/YYYY)',
      );
    }

    // Get member ID from group-service
    const authHeader = req.headers.authorization || '';
    const memberId = await this.groupClientService.getMyMemberId(
      groupId,
      authHeader,
    );

    return this.groupExpenseService.getPaymentHistory(
      groupId,
      String(memberId),
      monthYear,
    );
  }

  @Post('mark-paid')
  @ApiOperation({
    summary: 'Mark a debt as paid (payer only)',
    description:
      'Marks a share as paid and creates settlement transactions for both payer and debtor',
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
    const memberId = await this.groupClientService.getMyMemberId(
      groupId,
      authHeader,
    );

    return this.groupExpenseService.markShareAsPaid(
      dto.shareId,
      memberId,
      groupId,
    );
  }

  @Get('owed-to-me')
  @ApiOperation({
    summary: 'Get list of unpaid debts owed to me',
    description:
      'Returns all unpaid shares from expenses where current user is the payer',
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
          shareId: {
            type: 'string',
            example: '123e4567-e89b-12d3-a456-426614174000',
          },
          expenseId: {
            type: 'string',
            example: '123e4567-e89b-12d3-a456-426614174000',
          },
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
    const memberId = await this.groupClientService.getMyMemberId(
      groupId,
      authHeader,
    );

    return this.groupExpenseService.getOwedToMe(groupId, String(memberId));
  }

  @Post('upload-proof')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({
    summary: 'Upload payment proof image',
    description: 'Upload an image as proof of payment for a share (debtor only)',
  })
  @ApiParam({ name: 'groupId', description: 'Group ID' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Payment proof image (jpg, jpeg, png, gif, webp)',
        },
        shareId: {
          type: 'string',
          format: 'uuid',
          description: 'Share ID to upload proof for',
        },
      },
      required: ['file', 'shareId'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Proof uploaded successfully',
    schema: {
      type: 'object',
      properties: {
        shareId: { type: 'string', format: 'uuid' },
        proofImageUrl: { type: 'string', example: '/uploads/proofs/abc123.jpg' },
        proofStatus: { type: 'string', enum: ['pending'] },
        proofUploadedAt: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Bad request - no file or invalid share' })
  @ApiResponse({ status: 403, description: 'Only the debtor can upload proof' })
  async uploadProof(
    @Param('groupId') groupId: string,
    @Body() dto: UploadProofDto,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: Request,
  ) {
    const userId = getUserIdFromRequest(req);
    if (!userId) throw new BadRequestException('Missing or invalid JWT token');

    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    const authHeader = req.headers.authorization || '';
    const memberId = await this.groupClientService.getMyMemberId(
      groupId,
      authHeader,
    );

    const imageUrl = `/uploads/proofs/${file.filename}`;

    return this.groupExpenseService.uploadProof(
      dto.shareId,
      String(memberId),
      groupId,
      imageUrl,
    );
  }

  @Post('review-proof')
  @ApiOperation({
    summary: 'Approve or reject payment proof',
    description: 'Payer reviews and approves/rejects the proof uploaded by debtor',
  })
  @ApiParam({ name: 'groupId', description: 'Group ID' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        shareId: {
          type: 'string',
          format: 'uuid',
          description: 'Share ID to review proof for',
        },
        approved: {
          type: 'boolean',
          description: 'true to approve, false to reject',
        },
      },
      required: ['shareId', 'approved'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Proof reviewed successfully',
    schema: {
      type: 'object',
      properties: {
        shareId: { type: 'string', format: 'uuid' },
        proofStatus: { type: 'string', enum: ['approved', 'rejected'] },
        isPaid: { type: 'boolean' },
        paidAt: { type: 'string', format: 'date-time', nullable: true },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'No pending proof to review' })
  @ApiResponse({ status: 403, description: 'Only the payer can review proof' })
  async reviewProof(
    @Param('groupId') groupId: string,
    @Body() dto: { shareId: string; approved: boolean },
    @Req() req: Request,
  ) {
    const userId = getUserIdFromRequest(req);
    if (!userId) throw new BadRequestException('Missing or invalid JWT token');

    if (!dto.shareId) {
      throw new BadRequestException('shareId is required');
    }

    if (typeof dto.approved !== 'boolean') {
      throw new BadRequestException('approved must be a boolean');
    }

    const authHeader = req.headers.authorization || '';
    const memberId = await this.groupClientService.getMyMemberId(
      groupId,
      authHeader,
    );

    return this.groupExpenseService.reviewProof(
      dto.shareId,
      String(memberId),
      groupId,
      dto.approved,
    );
  }
}
