import { Controller, Get, Req, UnauthorizedException } from '@nestjs/common';
import { AccountService } from './account.service';

@Controller('account')
export class AccountController {
  constructor(private readonly accountService: AccountService) {}

  @Get('balance')
  async getBalance(@Req() req) {
    const userId = req.headers['x-user-id'];
    if (!userId) throw new UnauthorizedException();

    return this.accountService.getBalance(userId);
  }
}
