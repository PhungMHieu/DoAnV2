import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ReportServiceController } from './report-service.controller';
import { ReportEventController } from './report-event.controller';
import { ReportServiceService } from './report-service.service';
import { RedisCommonModule } from '@app/redis-common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtExtractMiddleware } from '@app/common';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    RedisCommonModule,
    // HttpModule.registerAsync({
    //   imports: [ConfigModule],
    //   inject: [ConfigService],
    //   useFactory: (config: ConfigService) => ({
    //     baseURL:
    //       config.get<string>('TRANSACTION_SERVICE_URL') ||
    //       'http://transaction-service:3001',
    //     timeout: config.get<number>('HTTP_TIMEOUT') || 3000,
    //   }),
    // }),
  ],
  controllers: [ReportServiceController, ReportEventController],
  providers: [ReportServiceService],
})
export class ReportServiceModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(JwtExtractMiddleware).forRoutes('*');
  }
}
