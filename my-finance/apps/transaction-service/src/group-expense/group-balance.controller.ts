import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';
import { GroupBalanceService } from './group-balance.service';

@ApiTags('Group Balances')
@Controller('groups/:groupId/balances')
export class GroupBalanceController {
  constructor(private readonly groupBalanceService: GroupBalanceService) {}

  @Get()
  @ApiOperation({ summary: 'Get simplified balances (who owes whom)' })
  @ApiParam({ name: 'groupId', description: 'Group ID' })
  @ApiResponse({
    status: 200,
    description: 'Simplified balance settlements',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          from: { type: 'string', description: 'Member ID who owes' },
          to: { type: 'string', description: 'Member ID who is owed' },
          amount: { type: 'number', description: 'Amount to pay' },
        },
      },
    },
  })
  async getBalances(@Param('groupId') groupId: string) {
    return this.groupBalanceService.getSimplifiedBalances(groupId);
  }
}
