import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ReportServiceController } from './report-service.controller';
import { ReportEventController } from './report-event.controller';
import { ReportServiceService } from './report-service.service';
import { RedisCommonModule } from '@app/redis-common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtExtractMiddleware } from '@app/common';
import { HttpModule } from '@nestjs/axios';
import { TransactionClientService } from './transaction-client.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    RedisCommonModule,
    HttpModule.register({
      timeout: 5000,
      maxRedirects: 5,
    }),
  ],
  controllers: [ReportServiceController, ReportEventController],
  providers: [ReportServiceService, TransactionClientService],
})
export class ReportServiceModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(JwtExtractMiddleware).forRoutes('*');
  }
}
