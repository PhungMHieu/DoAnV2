// transaction-service/src/group-expense/entities/group-expense.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  Index,
} from 'typeorm';
import { GroupExpenseShare } from './group-expense-share.entity';

@Entity('group_expenses')
export class GroupExpense {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  groupId: string; // tham chiếu đến Group.id (foreign key logical)

  @Column()
  title: string;

  @Column('numeric', { precision: 18, scale: 2 })
  amount: string;

  // Ai trả tiền – tham chiếu GroupMember.id
  @Column()
  paidByMemberId: string;

  // optional: lưu user tạo expense
  @Column()
  createdByUserId: string;

  @Column({ type: 'timestamptz' })
  createdAt: Date;

  @OneToMany(
    () => GroupExpenseShare,
    (share: GroupExpenseShare) => share.expense,
    { cascade: true },
  )
  shares: GroupExpenseShare[];

  @Column({ default: 'equal' })
  splitType: 'equal' | 'exact' | 'percent';
}
