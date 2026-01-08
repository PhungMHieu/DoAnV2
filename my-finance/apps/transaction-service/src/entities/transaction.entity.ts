import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { GroupExpense } from '../group-expense/entities/group-expense.entity';

@Entity('transactions')
@Index(['userId'])
@Index(['userId', 'dateTime'])
@Index(['groupExpenseId'])
export class TransactionEntity {
  @ApiProperty({
    description: 'Unique identifier for the transaction',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({
    description: 'Transaction amount',
    example: 50000,
    type: Number,
  })
  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value),
    },
  })
  amount: number;

  @ApiProperty({
    description: 'Transaction category',
    example: 'food',
  })
  @Column({ type: 'varchar', length: 100 })
  category: string;

  @ApiProperty({
    description: 'Optional transaction description',
    example: 'Lunch with colleagues',
    required: false,
  })
  @Column({ type: 'text', nullable: true })
  note?: string;

  @ApiProperty({
    description: 'User ID who owns this transaction',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @ApiProperty({
    description: 'Transaction creation timestamp',
    example: '2025-10-31T00:00:00.000Z',
    type: Date,
  })
  @Column({ type: 'timestamptz', name: 'date_time' })
  dateTime: Date;

  // Relation với GroupExpense (nullable - transaction có thể không thuộc group nào)
  @Column({ type: 'uuid', nullable: true })
  groupExpenseId: string | null;

  @ManyToOne(() => GroupExpense, (expense) => expense.transactions, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'groupExpenseId' })
  groupExpense: GroupExpense | null;
}
