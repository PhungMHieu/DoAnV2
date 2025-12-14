import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GroupServiceController } from './group-service.controller';
import { GroupServiceService } from './group-service.service';
import { Group } from './entities/group.entity';
import { GroupMember } from './entities/GroupMember.entity';
import { AuthCommonModule } from '@app/auth-common/auth-common.module';

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
        entities: [Group, GroupMember],
        synchronize: config.get<string>('NODE_ENV') !== 'production',
        logging: config.get<string>('NODE_ENV') === 'development',
      }),
    }),
    TypeOrmModule.forFeature([Group, GroupMember]),
    AuthCommonModule,
  ],
  controllers: [GroupServiceController],
  providers: [GroupServiceService],
})
export class GroupServiceModule {}
