import { Controller, Get, Req, UnauthorizedException } from '@nestjs/common';
import { 
  ApiTags, 
  ApiOperation, 
  ApiResponse, 
  ApiHeader
} from '@nestjs/swagger';
import { AccountService } from './account.service';

@ApiTags('Account')
@ApiHeader({
  name: 'x-user-id',
  description: 'User ID for authentication',
  required: true,
  schema: { type: 'string' }
})
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
  @ApiResponse({ status: 401, description: 'Missing x-user-id header' })
  async getBalance(@Req() req) {
    const userId = req.headers['x-user-id'];
    if (!userId) throw new UnauthorizedException();

    return this.accountService.getBalance(userId);
  }
}
