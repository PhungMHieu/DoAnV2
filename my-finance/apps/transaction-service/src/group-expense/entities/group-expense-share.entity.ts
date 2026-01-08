// transaction-service/src/group-expense/entities/group-expense-share.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  Index,
} from 'typeorm';
import { GroupExpense } from './group-expense.entity';

@Entity('group_expense_shares')
export class GroupExpenseShare {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => GroupExpense, (expense) => expense.shares, {
    onDelete: 'CASCADE',
  })
  expense: GroupExpense;

  @Column()
  @Index()
  expenseId: string;

  // GroupMemberId tham gia share
  @Column()
  @Index()
  memberId: string;

  // Tên member lúc tạo expense (để hiển thị khi member rời nhóm)
  @Column({ nullable: true })
  memberName: string;

  // Số tiền mà member này phải chịu (sau khi tính từ kiểu split)
  @Column('numeric', { precision: 18, scale: 2 })
  amount: string;

  // Settlement tracking
  @Column({ type: 'boolean', default: false })
  @Index()
  isPaid: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  paidAt: Date | null;

  // Denormalized userId for faster settlement processing
  @Column({ type: 'varchar', nullable: true })
  userId: string | null;

  // Payment proof fields
  @Column({ type: 'varchar', nullable: true })
  proofImageUrl: string | null;

  @Column({
    type: 'varchar',
    default: 'none',
  })
  proofStatus: 'none' | 'pending' | 'approved' | 'rejected';

  @Column({ type: 'timestamptz', nullable: true })
  proofUploadedAt: Date | null;
}
