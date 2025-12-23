import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

/**
 * Request DTO cho category prediction
 */
export class PredictCategoryDto {
  @ApiProperty({
    description: 'Transaction description/note to classify',
    example: 'Mua cơm trưa quán Phở 24',
  })
  @IsString()
  @IsNotEmpty()
  note: string;

  @ApiProperty({
    description: 'Transaction amount (optional, can improve prediction)',
    example: 50000,
    required: false,
  })
  @IsOptional()
  amount?: number;
}

/**
 * Response DTO cho category prediction
 */
export class PredictCategoryResponseDto {
  @ApiProperty({
    description: 'Predicted category',
    example: 'food',
  })
  category: string;

  @ApiProperty({
    description: 'Confidence score (0-1)',
    example: 0.85,
  })
  confidence: number;

  @ApiProperty({
    description: 'Alternative suggestions with scores',
    example: [
      { category: 'food', confidence: 0.85 },
      { category: 'entertainment', confidence: 0.10 },
      { category: 'other', confidence: 0.05 },
    ],
  })
  suggestions: Array<{ category: string; confidence: number }>;

  @ApiProperty({
    description: 'Model used for prediction',
    example: 'keyword-matcher-v1',
  })
  model: string;
}
