import { InjectRepository } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { User } from './entities/User';
import { Repository, ILike } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AuthServiceService {
  private readonly jwtIssuer: string;

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {
    // Kong JWT key - phải khớp với key được tạo trong Kong
    this.jwtIssuer =
      this.configService.get<string>('JWT_ISSUER') || 'my-finance-app';
  }

  async register(
    user: User,
  ): Promise<{ message: string; user: User; accessToken: string }> {
    const hashedPassword = await bcrypt.hash(user.password, 10);
    const newUser = this.userRepository.create({
      username: user.username,
      email: user.email,
      password: hashedPassword,
    });
    await this.userRepository.save(newUser);

    const accessToken = await this.jwtService.signAsync({
      iss: this.jwtIssuer, // Kong cần iss để xác thực
      sub: newUser.id,
      email: newUser.email,
    });

    delete (newUser as any).password;

    return {
      message: 'Register success',
      user: newUser,
      accessToken,
    };
  }

  async validateUser(username: string, password: string): Promise<User | null> {
    console.log(`[Auth] Attempting login for username: ${username}`);

    const user = await this.userRepository.findOne({ where: { username } });
    if (!user) {
      console.log(`[Auth] ❌ User not found: ${username}`);
      return null;
    }

    console.log(`[Auth] ✅ User found: ${username} (id: ${user.id})`);

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      console.log(`[Auth] ❌ Password mismatch for user: ${username}`);
      return null;
    }

    console.log(`[Auth] ✅ Password matched for user: ${username}`);
    delete (user as any).password;
    return user;
  }

  async login(
    user: User,
  ): Promise<{ accessToken: string; user: Omit<User, 'password'> }> {
    const payload = {
      iss: this.jwtIssuer, // Kong cần iss để xác thực
      sub: user.id,
      email: user.email,
    };
    return {
      accessToken: this.jwtService.sign(payload),
      user,
    };
  }

  async searchUsers(
    query: string,
    limit: number = 10,
  ): Promise<Omit<User, 'password'>[]> {
    if (!query || query.trim().length < 2) {
      return [];
    }

    const users = await this.userRepository.find({
      where: [
        { username: ILike(`%${query}%`) },
        { email: ILike(`%${query}%`) },
      ],
      take: limit,
      select: ['id', 'username', 'email', 'createdAt'],
    });

    return users;
  }
}
