import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AuthServiceService } from './auth-service.service';
import { User } from './entities/User';
import { AuthGuard } from '@nestjs/passport';

@Controller('auth')
export class AuthServiceController {
  constructor(private readonly authServiceService: AuthServiceService) {}
  @UseGuards(AuthGuard('jwt'))
  @Post('register')
  register(@Body() user: User) {
    return this.authServiceService.register(user);
  }
  
  @Post('login')
  async login(@Body() user: User) {
    return this.authServiceService.validateUser(user.username, user.password)
      .then(user => {
        if (!user) {
          throw new Error('Invalid credentials');
        }
        return this.authServiceService.login(user);
      });
  }

  @Post('logout')
  logout() {
    return { message: 'Logout success' };
  }
}
