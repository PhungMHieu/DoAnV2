import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export type PaymentType = 'paid' | 'received';

export class PaymentHistoryItem {
  @ApiProperty({ description: 'Ngày giao dịch' })
  date: Date;

  @ApiProperty({ enum: ['paid', 'received'], description: 'Loại: paid = đã trả, received = đã nhận' })
  type: PaymentType;

  @ApiProperty({ description: 'Số tiền' })
  amount: number;

  @ApiProperty({ description: 'ID chi tiêu' })
  expenseId: string;

  @ApiProperty({ description: 'Tiêu đề/mô tả chi tiêu', example: 'Ăn trưa ở quán ABC' })
  expenseTitle: string;

  @ApiProperty({ description: 'Danh mục' })
  category: string;

  @ApiPropertyOptional({ description: 'Người gửi (chỉ có khi type = received)' })
  from?: string;

  @ApiPropertyOptional({ description: 'Member ID người gửi' })
  fromMemberId?: string;

  @ApiPropertyOptional({ description: 'Người nhận (chỉ có khi type = paid cho cá nhân)' })
  to?: string;

  @ApiPropertyOptional({ description: 'Member ID người nhận' })
  toMemberId?: string;

  @ApiProperty({ description: 'Ghi chú' })
  note: string;
}

export class PaymentHistorySummary {
  @ApiProperty({ description: 'Tổng tiền đã trả' })
  totalPaid: number;

  @ApiProperty({ description: 'Tổng tiền đã nhận' })
  totalReceived: number;

  @ApiProperty({ description: 'Số dư (+ = nhận nhiều hơn, - = trả nhiều hơn)' })
  net: number;
}

export class PaymentHistoryResponse {
  @ApiProperty({ description: 'Tháng/năm', example: '12/2025' })
  month: string;

  @ApiProperty({ type: [PaymentHistoryItem], description: 'Danh sách giao dịch' })
  payments: PaymentHistoryItem[];

  @ApiProperty({ type: PaymentHistorySummary, description: 'Tổng kết' })
  summary: PaymentHistorySummary;
}

export class DebtItem {
  @ApiProperty({ description: 'Share ID' })
  shareId: string;

  @ApiProperty({ description: 'Expense ID' })
  expenseId: string;

  @ApiProperty({ description: 'Tiêu đề chi tiêu' })
  expenseTitle: string;

  @ApiProperty({ description: 'Tổng số tiền chi tiêu' })
  totalAmount: string;

  @ApiProperty({ description: 'Phần tiền của tôi' })
  myShare: string;

  @ApiProperty({ description: 'Member ID người đã trả' })
  paidByMemberId: string;

  @ApiProperty({ description: 'Tên người đã trả' })
  paidByMemberName: string;

  @ApiProperty({ description: 'Ngày tạo' })
  createdAt: Date;

  @ApiProperty({ enum: ['equal', 'exact', 'percent'], description: 'Loại chia' })
  splitType: string;

  @ApiProperty({ description: 'Đã trả chưa' })
  isPaid: boolean;
}

export class OwedToMeItem {
  @ApiProperty({ description: 'Share ID' })
  shareId: string;

  @ApiProperty({ description: 'Expense ID' })
  expenseId: string;

  @ApiProperty({ description: 'Tiêu đề chi tiêu' })
  expenseTitle: string;

  @ApiProperty({ description: 'Tổng số tiền chi tiêu' })
  totalAmount: string;

  @ApiProperty({ description: 'Số tiền nợ' })
  shareAmount: string;

  @ApiProperty({ description: 'Member ID người nợ' })
  debtorMemberId: string;

  @ApiProperty({ description: 'Tên người nợ' })
  debtorMemberName: string;

  @ApiProperty({ description: 'Ngày tạo' })
  createdAt: Date;

  @ApiProperty({ description: 'Đã trả chưa' })
  isPaid: boolean;
}
