import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { MulterModule } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { GroupExpense } from './entities/group-expense.entity';
import { GroupExpenseShare } from './entities/group-expense-share.entity';
import { GroupExpenseService } from './group-expense.service';
import { GroupExpenseController } from './group-expense.controller';
import { GroupBalanceController } from './group-balance.controller';
import { GroupBalanceService } from './group-balance.service';
import { GroupClientService } from './group-client.service';
import { WebSocketCommonModule } from '@app/websocket-common';

@Module({
  imports: [
    TypeOrmModule.forFeature([GroupExpense, GroupExpenseShare]),
    HttpModule.register({
      timeout: 5000,
      maxRedirects: 5,
    }),
    WebSocketCommonModule,
    MulterModule.register({
      storage: diskStorage({
        destination: './uploads/proofs',
        filename: (req, file, cb) => {
          const uniqueSuffix = uuidv4();
          const ext = extname(file.originalname);
          cb(null, `${uniqueSuffix}${ext}`);
        },
      }),
      fileFilter: (req, file, cb) => {
        if (!file.mimetype.match(/\/(jpg|jpeg|png|gif|webp)$/)) {
          cb(new Error('Only image files are allowed!'), false);
        } else {
          cb(null, true);
        }
      },
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB
      },
    }),
  ],
  providers: [GroupExpenseService, GroupBalanceService, GroupClientService],
  controllers: [GroupExpenseController, GroupBalanceController],
  exports: [GroupExpenseService, GroupBalanceService],
})
export class GroupExpenseModule {}
