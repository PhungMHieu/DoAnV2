// transaction-service/src/group-expense/entities/group-expense.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  Index,
} from 'typeorm';
import { GroupExpenseShare } from './group-expense-share.entity';
import { TransactionEntity } from '../../entities/transaction.entity';

@Entity('group_expenses')
export class GroupExpense {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  groupId: string; // tham chiếu đến Group.id (foreign key logical)

  @Column()
  title: string;

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

  // Danh sách transactions thuộc expense này
  // Không dùng cascade: true để tránh xóa transactions khi expense bị xóa
  // và ngược lại - GroupExpense không bị ảnh hưởng khi Transaction bị xóa
  @OneToMany(() => TransactionEntity, (transaction) => transaction.groupExpense)
  transactions: TransactionEntity[];

  @OneToMany(
    () => GroupExpenseShare,
    (share: GroupExpenseShare) => share.expense,
    { cascade: true },
  )
  shares: GroupExpenseShare[];

  @Column({ default: 'equal' })
  splitType: 'equal' | 'exact' | 'percent';

  // Getter để tính tổng amount từ transactions
  get totalAmount(): number {
    if (!this.transactions || this.transactions.length === 0) {
      return 0;
    }
    return this.transactions.reduce((sum, tx) => sum + Number(tx.amount), 0);
  }
}
