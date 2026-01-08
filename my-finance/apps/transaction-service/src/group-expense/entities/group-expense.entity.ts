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

  @Column({ nullable: true })
  category: string; // Category of the expense (e.g., "food", "transport")

  // Ai trả tiền – tham chiếu GroupMember.id
  @Column()
  paidByMemberId: string;

  // Tên member lúc tạo expense (để hiển thị khi member rời nhóm)
  @Column({ nullable: true })
  paidByMemberName: string;

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
