import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { REDIS_CLIENT } from './lib/redis.constants';
import { RedisCommonService } from './redis-common.service';

@Module({
  imports: [ConfigModule], // dùng .env để lấy REDIS_URL
  providers: [
    {
      provide: REDIS_CLIENT,
      useFactory: (configService: ConfigService): Redis => {
        const url = configService.get<string>('REDIS_URL') || 'redis://localhost:6379';
        return new Redis(url);
      },
      inject: [ConfigService],
    },
    RedisCommonService,
  ],
  exports: [REDIS_CLIENT, RedisCommonService],
})
export class RedisCommonModule {}
