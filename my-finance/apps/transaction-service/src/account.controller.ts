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
}
