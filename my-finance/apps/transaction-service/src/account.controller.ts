import { Controller, Get, Req, UnauthorizedException } from '@nestjs/common';
import { 
  ApiTags, 
  ApiOperation, 
  ApiResponse, 
  ApiBearerAuth
} from '@nestjs/swagger';
import { AccountService } from './account.service';
import { getUserIdFromRequest } from '@app/common/middleware/jwt-extract.middleware';

@ApiTags('Account')
@ApiBearerAuth('access-token')
@Controller('account')
export class AccountController {
  constructor(private readonly accountService: AccountService) {}

  @Get('balance')
  @ApiOperation({
    summary: 'Get account balance',
    description: 'Retrieves the current account balance for the user'
  })
  @ApiResponse({
    status: 200,
    description: 'Account balance retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        balance: { type: 'number', example: 2500000 }
      }
    }
  })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT token' })
  async getBalance(@Req() req) {
    const userId = getUserIdFromRequest(req);
    if (!userId) throw new UnauthorizedException('Missing or invalid JWT token');

    return this.accountService.getBalance(userId);
  }

  @Get('admin/recalculate-balance')
  @ApiOperation({
    summary: '[Admin] Recalculate account balance from transactions',
    description: 'Fixes desync between account balance and transaction history by recalculating from all transactions'
  })
  @ApiResponse({
    status: 200,
    description: 'Balance recalculated successfully',
    schema: {
      type: 'object',
      properties: {
        userId: { type: 'string' },
        oldBalance: { type: 'number', example: -27000 },
        newBalance: { type: 'number', example: -31240 },
        difference: { type: 'number', example: -4240 },
        transactionsProcessed: { type: 'number', example: 17 }
      }
    }
  })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT token' })
  async recalculateBalance(@Req() req) {
    const userId = getUserIdFromRequest(req);
    if (!userId) throw new UnauthorizedException('Missing or invalid JWT token');

    return this.accountService.recalculateBalance(userId);
  }
}
