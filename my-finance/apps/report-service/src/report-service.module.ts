import { Module } from '@nestjs/common';
import { ReportServiceController } from './report-service.controller';
import { ReportServiceService } from './report-service.service';
import { RedisCommonModule } from '@app/redis-common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    RedisCommonModule,
    HttpModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        baseURL:
          config.get<string>('TRANSACTION_SERVICE_URL') ||
          'http://transaction-service:3001', // URL của transaction-service
        timeout: 3000,
      }),
    }),
  ],
  controllers: [ReportServiceController],
  providers: [ReportServiceService],
})
export class ReportServiceModule {}
