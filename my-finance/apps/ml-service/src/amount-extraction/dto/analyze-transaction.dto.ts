import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

/**
 * Request DTO for analyzing transaction text
 */
export class AnalyzeTransactionDto {
  @ApiProperty({
    description: 'Vietnamese text containing transaction info (amount + description)',
    example: 'ăn phở 50k',
  })
  @IsString()
  @IsNotEmpty()
  text: string;
}

/**
 * Response DTO for transaction analysis
 */
export class AnalyzeTransactionResponseDto {
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
    example: 'food',
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
