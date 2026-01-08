import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GroupServiceController } from './group-service.controller';
import { GroupServiceService } from './group-service.service';
import { Group } from './entities/group.entity';
import { GroupMember } from './entities/GroupMember.entity';
import { GroupInvitation } from './entities/group-invitation.entity';
import { AuthCommonModule } from '@app/auth-common/auth-common.module';
import { JwtExtractMiddleware } from '@app/common';
import { WebSocketCommonModule } from '@app/websocket-common';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.get<string>('DATABASE_URL'),
        entities: [Group, GroupMember, GroupInvitation],
        synchronize: config.get<string>('NODE_ENV') !== 'production',
        logging: config.get<string>('NODE_ENV') === 'development',
      }),
    }),
    TypeOrmModule.forFeature([Group, GroupMember, GroupInvitation]),
    AuthCommonModule,
    WebSocketCommonModule,
  ],
  controllers: [GroupServiceController],
  providers: [GroupServiceService],
})
export class GroupServiceModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(JwtExtractMiddleware).forRoutes('*');
  }
}
