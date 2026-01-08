import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsPositive,
  IsEnum,
  IsArray,
  ArrayMinSize,
  ValidateNested,
  ValidateIf,
  IsOptional,
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum SplitType {
  EQUAL = 'equal',
  EXACT = 'exact',
  PERCENT = 'percent',
}

// Transaction item trong expense
export class TransactionItemDto {
  @ApiProperty({
    description: 'Amount of the transaction',
    example: 100000,
  })
  @IsNumber()
  @IsPositive()
  amount: number;

  @ApiProperty({
    description: 'Category of the transaction',
    example: 'food',
  })
  @IsString()
  @IsNotEmpty()
  category: string;

  @ApiPropertyOptional({
    description: 'Note for the transaction',
    example: 'Dinner at restaurant',
  })
  @IsString()
  @IsOptional()
  note?: string;

  @ApiPropertyOptional({
    description: 'Date time of the transaction',
    example: '2024-01-15T10:30:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  dateTime?: string;
}

// Participant với cả memberId và userId
export class ParticipantDto {
  @ApiProperty({
    description: 'Member ID trong group',
    example: 'member_123',
  })
  @IsString()
  @IsNotEmpty()
  memberId: string;

  @ApiProperty({
    description: 'User ID của member',
    example: 'user_456',
  })
  @IsString()
  @IsNotEmpty()
  userId: string;

  @ApiProperty({
    description: 'Tên member',
    example: 'Nguyen Van A',
  })
  @IsString()
  @IsNotEmpty()
  memberName: string;
}

export class ExactSplitItemDto {
  @ApiProperty({
    description: 'Member ID',
    example: 'member-uuid-1',
  })
  @IsString()
  @IsNotEmpty()
  memberId: string;

  @ApiProperty({
    description: 'User ID của member',
    example: 'user-uuid-1',
  })
  @IsString()
  @IsNotEmpty()
  userId: string;

  @ApiProperty({
    description: 'Tên member',
    example: 'Nguyen Van A',
  })
  @IsString()
  @IsNotEmpty()
  memberName: string;

  @ApiProperty({
    description: 'Amount for this member',
    example: 200.5,
  })
  @IsNumber()
  @IsPositive()
  amount: number;
}

export class PercentSplitItemDto {
  @ApiProperty({
    description: 'Member ID',
    example: 'member-uuid-1',
  })
  @IsString()
  @IsNotEmpty()
  memberId: string;

  @ApiProperty({
    description: 'User ID của member',
    example: 'user-uuid-1',
  })
  @IsString()
  @IsNotEmpty()
  userId: string;

  @ApiProperty({
    description: 'Tên member',
    example: 'Nguyen Van A',
  })
  @IsString()
  @IsNotEmpty()
  memberName: string;

  @ApiProperty({
    description: 'Percentage for this member (0-100)',
    example: 40,
  })
  @IsNumber()
  @IsPositive()
  percent: number;
}

export class CreateExpenseDto {
  @ApiProperty({
    description: 'Expense title/description',
    example: 'Dinner at restaurant',
  })
  @IsString()
  @IsNotEmpty({ message: 'title is required' })
  title: string;

  @ApiProperty({
    description: 'List of transactions in this expense',
    type: [TransactionItemDto],
    example: [
      { amount: 200000, category: 'food', note: 'Main course' },
      { amount: 50000, category: 'food', note: 'Drinks' },
    ],
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'transactions must have at least 1 item' })
  @ValidateNested({ each: true })
  @Type(() => TransactionItemDto)
  transactions: TransactionItemDto[];

  @ApiProperty({
    description: 'Member ID who paid for this expense',
    example: 'member_123',
  })
  @IsString()
  @IsNotEmpty({ message: 'paidByMemberId is required' })
  paidByMemberId: string;

  @ApiProperty({
    description: 'User ID của người trả tiền',
    example: 'user_456',
  })
  @IsString()
  @IsNotEmpty({ message: 'paidByUserId is required' })
  paidByUserId: string;

  @ApiProperty({
    description: 'Tên người trả tiền',
    example: 'Nguyen Van A',
  })
  @IsString()
  @IsNotEmpty({ message: 'paidByMemberName is required' })
  paidByMemberName: string;

  @ApiPropertyOptional({
    description: 'Date of the expense (ISO 8601 format)',
    example: '2024-01-15T10:30:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  date?: string;

  @ApiProperty({
    description: 'Split type',
    enum: SplitType,
    example: SplitType.EQUAL,
  })
  @IsEnum(SplitType, {
    message: 'splitType must be one of: equal, exact, percent',
  })
  splitType: SplitType;

  // For equal split - danh sách participants với memberId và userId
  @ApiPropertyOptional({
    description: 'Participants (required for equal split)',
    type: [ParticipantDto],
    example: [
      { memberId: 'member_123', userId: 'user_456' },
      { memberId: 'member_789', userId: 'user_999' },
    ],
  })
  @ValidateIf((o) => o.splitType === SplitType.EQUAL)
  @IsArray()
  @ArrayMinSize(1, {
    message: 'participants must be non-empty array for equal split',
  })
  @ValidateNested({ each: true })
  @Type(() => ParticipantDto)
  participants?: ParticipantDto[];

  // For exact split
  @ApiPropertyOptional({
    description: 'Exact split amounts (required for exact split)',
    type: [ExactSplitItemDto],
    example: [
      { memberId: 'member-uuid-1', amount: 200 },
      { memberId: 'member-uuid-2', amount: 300 },
    ],
  })
  @ValidateIf((o) => o.splitType === SplitType.EXACT)
  @IsArray()
  @ArrayMinSize(1, {
    message: 'splits must be non-empty array for exact split',
  })
  @ValidateNested({ each: true })
  @Type(() => ExactSplitItemDto)
  exactSplits?: ExactSplitItemDto[];

  // For percent split
  @ApiPropertyOptional({
    description: 'Percent split values (required for percent split)',
    type: [PercentSplitItemDto],
    example: [
      { memberId: 'member-uuid-1', percent: 40 },
      { memberId: 'member-uuid-2', percent: 60 },
    ],
  })
  @ValidateIf((o) => o.splitType === SplitType.PERCENT)
  @IsArray()
  @ArrayMinSize(1, {
    message: 'splits must be non-empty array for percent split',
  })
  @ValidateNested({ each: true })
  @Type(() => PercentSplitItemDto)
  percentSplits?: PercentSplitItemDto[];
}
