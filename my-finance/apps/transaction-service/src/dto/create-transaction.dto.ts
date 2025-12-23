import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsString, IsOptional, IsDateString, Min } from 'class-validator';

/**
 * DTO for creating a new transaction
 *
 * AI Auto-categorization behavior:
 * - If `category` is provided → Use user's choice (AI will NOT override)
 * - If `category` is missing BUT `note` is provided → AI auto-predicts category
 * - If both missing → Defaults to 'other'
 */
export class CreateTransactionDto {
  @ApiProperty({
    description: 'Transaction amount (must be positive)',
    example: 50000,
    type: Number,
    minimum: 0.01,
  })
  @IsNumber()
  @Min(0.01, { message: 'Amount must be greater than 0' })
  amount: number;

  @ApiProperty({
    description:
      'Transaction category. ' +
      'OPTIONAL - If not provided and note exists, AI will auto-predict. ' +
      'If provided, user choice will be respected (AI will NOT override).',
    example: 'food',
    required: false,
    enum: [
      'income',
      'food',
      'transport',
      'entertainment',
      'shopping',
      'healthcare',
      'education',
      'bills',
      'housing',
      'personal',
      'other',
    ],
  })
  @IsString()
  @IsOptional()
  category?: string;

  @ApiProperty({
    description:
      'Transaction description/note. ' +
      'Used by AI for auto-categorization if category is not provided.',
    example: 'Lunch at Phở 24',
    required: false,
  })
  @IsString()
  @IsOptional()
  note?: string;

  @ApiProperty({
    description: 'Transaction date and time',
    example: '2024-12-21T12:00:00Z',
    type: String,
    format: 'date-time',
  })
  @IsDateString()
  dateTime: Date;
}
