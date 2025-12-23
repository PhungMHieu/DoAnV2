import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsNumber, IsPositive, IsEnum, IsArray, ArrayMinSize, ValidateNested, ValidateIf } from 'class-validator';
import { Type } from 'class-transformer';

export enum SplitType {
  EQUAL = 'equal',
  EXACT = 'exact',
  PERCENT = 'percent',
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
    description: 'Amount for this member',
    example: 200.50,
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
    description: 'Total expense amount',
    example: 500.00,
  })
  @IsNumber()
  @IsPositive({ message: 'amount must be a positive number' })
  amount: number;

  @ApiProperty({
    description: 'Member ID who paid for this expense',
    example: 'member-uuid-1',
  })
  @IsString()
  @IsNotEmpty({ message: 'paidByMemberId is required' })
  paidByMemberId: string;

  @ApiProperty({
    description: 'Split type',
    enum: SplitType,
    example: SplitType.EQUAL,
  })
  @IsEnum(SplitType, { message: 'splitType must be one of: equal, exact, percent' })
  splitType: SplitType;

  // For equal split
  @ApiPropertyOptional({
    description: 'Participant member IDs (required for equal split)',
    type: [String],
    example: ['member-uuid-1', 'member-uuid-2', 'member-uuid-3'],
  })
  @ValidateIf((o) => o.splitType === SplitType.EQUAL)
  @IsArray()
  @ArrayMinSize(1, { message: 'participantMemberIds must be non-empty array for equal split' })
  @IsString({ each: true })
  @IsNotEmpty({ each: true, message: 'participantMemberIds must be array of non-empty strings' })
  participantMemberIds?: string[];

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
  @ArrayMinSize(1, { message: 'splits must be non-empty array for exact split' })
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
  @ArrayMinSize(1, { message: 'splits must be non-empty array for percent split' })
  @ValidateNested({ each: true })
  @Type(() => PercentSplitItemDto)
  percentSplits?: PercentSplitItemDto[];
}
