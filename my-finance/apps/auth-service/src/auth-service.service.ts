import { InjectRepository } from "@nestjs/typeorm";
import { JwtService } from "@nestjs/jwt";
import { User } from "./entities/User";
import { Repository } from "typeorm";
import * as bcrypt from "bcrypt";
import { Injectable } from "@nestjs/common";

@Injectable()
export class AuthServiceService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly jwtService: JwtService,
  ) {}

  async register(user: User): Promise<{ message: string; user: User; accessToken: string }> {
    const hashedPassword = await bcrypt.hash(user.password, 10);
    const newUser = this.userRepository.create({ username: user.username, email: user.email, password: hashedPassword });
    await this.userRepository.save(newUser);

    const accessToken = await this.jwtService.signAsync({
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
    const user = await this.userRepository.findOne({ where: { username } });
    if (!user) return null;

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return null;

    delete (user as any).password;
    return user;
  }

  async login(user: User): Promise<{ accessToken: string }> {
    const payload = { email: user.email, sub: user.id };
    return {
      accessToken: this.jwtService.sign(payload),
    };
  }
}