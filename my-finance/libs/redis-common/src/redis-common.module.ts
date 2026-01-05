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
        const url =
          configService.get<string>('REDIS_URL') || 'redis://localhost:6379';
        return new Redis(url, {
          // Graceful degradation: Fail fast when Redis is down
          maxRetriesPerRequest: 3, // Only retry 3 times (default is 20)
          enableOfflineQueue: false, // Don't queue commands when offline
          retryStrategy: (times: number) => {
            // Reconnect after exponential backoff, max 3 seconds
            if (times > 10) return null; // Stop retrying after 10 attempts
            return Math.min(times * 100, 3000);
          },
          // Suppress connection error logs (handled by application logic)
          lazyConnect: false,
        });
      },
      inject: [ConfigService],
    },
    RedisCommonService,
  ],
  exports: [REDIS_CLIENT, RedisCommonService],
})
export class RedisCommonModule {}
