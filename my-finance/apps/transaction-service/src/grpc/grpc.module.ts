import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TransactionEntity } from '../entities/transaction.entity';
import { TransactionStatsGrpcController } from './transaction-stats.controller';

@Module({
  imports: [TypeOrmModule.forFeature([TransactionEntity])],
  controllers: [TransactionStatsGrpcController],
})
export class GrpcModule {}
