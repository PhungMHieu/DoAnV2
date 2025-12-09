import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { 
  ApiTags, 
  ApiOperation, 
  ApiResponse, 
  ApiBody,
  ApiBearerAuth
} from '@nestjs/swagger';
import { AuthServiceService } from './auth-service.service';
import { User } from './entities/User';
import { AuthGuard } from '@nestjs/passport';

@ApiTags('Authentication')
@Controller('auth')
export class AuthServiceController {
  constructor(private readonly authServiceService: AuthServiceService) {}
  
  @Post('register')
  @ApiOperation({ 
    summary: 'Register new user',
    description: 'Creates a new user account.'
  })
  @ApiBody({
    description: 'User registration data',
    schema: {
      type: 'object',
      properties: {
        username: { type: 'string', example: 'john_doe' },
        email: { type: 'string', example: 'john@example.com' },
        password: { type: 'string', example: 'password123' }
      },
      required: ['username', 'email', 'password']
    }
  })
  @ApiResponse({
    status: 201,
    description: 'User created successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', example: '123e4567-e89b-12d3-a456-426614174000' },
        username: { type: 'string', example: 'john_doe' },
        email: { type: 'string', example: 'john@example.com' },
        role: { type: 'string', example: 'user' }
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Bad request - Invalid user data' })
  register(@Body() user: User) {
    return this.authServiceService.register(user);
  }
  
  @Post('login')
  @ApiOperation({ 
    summary: 'User login',
    description: 'Authenticates user and returns JWT token'
  })
  @ApiBody({
    description: 'Login credentials',
    schema: {
      type: 'object',
      properties: {
        username: { type: 'string', example: 'john_doe' },
        password: { type: 'string', example: 'password123' }
      },
      required: ['username', 'password']
    }
  })
  @ApiResponse({
    status: 200,
    description: 'Login successful',
    schema: {
      type: 'object',
      properties: {
        access_token: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' },
        user: {
          type: 'object',
          properties: {
            id: { type: 'string', example: '123e4567-e89b-12d3-a456-426614174000' },
            username: { type: 'string', example: 'john_doe' },
            email: { type: 'string', example: 'john@example.com' }
          }
        }
      }
    }
  })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
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
  @ApiOperation({ 
    summary: 'User logout',
    description: 'Logs out the current user session'
  })
  @ApiResponse({
    status: 200,
    description: 'Logout successful',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Logout success' }
      }
    }
  })
  logout() {
    return { message: 'Logout success' };
  }
}
