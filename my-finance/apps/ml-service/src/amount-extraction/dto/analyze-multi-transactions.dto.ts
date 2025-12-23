import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

/**
 * Request DTO for analyzing multiple transactions from text
 */
export class AnalyzeMultiTransactionsDto {
  @ApiProperty({
    description:
      'Vietnamese text containing multiple transaction info (amounts + descriptions)',
    example:
      'tôi đi chơi với bạn và đã mua 1 cái tạp dề 50k. Chúng tôi còn ăn phở 90k',
  })
  @IsString()
  @IsNotEmpty()
  text: string;
}

/**
 * Single transaction result
 */
export class TransactionResult {
  @ApiProperty({
    description: 'Extracted sentence/phrase for this transaction',
    example: 'mua 1 cái tạp dề 50k',
  })
  sentence: string;

  @ApiProperty({
    description: 'Extracted amount (0 if not found)',
    example: 50000,
  })
  amount: number;

  @ApiProperty({
    description: 'Amount extraction confidence score (0-1)',
    example: 0.85,
  })
  amountConfidence: number;

  @ApiProperty({
    description: 'Original matched text for amount',
    example: '50k',
    required: false,
  })
  matchedText?: string;

  @ApiProperty({
    description: 'Method used for amount extraction',
    example: 'regex-k-notation',
  })
  extractionMethod: string;

  @ApiProperty({
    description: 'Predicted transaction category',
    example: 'shopping',
  })
  category: string;

  @ApiProperty({
    description: 'Category prediction confidence score (0-1)',
    example: 1.0,
  })
  categoryConfidence: number;

  @ApiProperty({
    description: 'Alternative category suggestions',
    type: 'array',
    items: {
      type: 'object',
      properties: {
        category: { type: 'string' },
        confidence: { type: 'number' },
      },
    },
  })
  suggestions: Array<{ category: string; confidence: number }>;

  @ApiProperty({
    description: 'Model used for category prediction',
    example: 'keyword-matcher-v1',
  })
  model: string;
}

/**
 * Response DTO for multi-transaction analysis
 */
export class AnalyzeMultiTransactionsResponseDto {
  @ApiProperty({
    description: 'Number of transactions found',
    example: 2,
  })
  count: number;

  @ApiProperty({
    description: 'List of transaction results',
    type: [TransactionResult],
  })
  transactions: TransactionResult[];
}
