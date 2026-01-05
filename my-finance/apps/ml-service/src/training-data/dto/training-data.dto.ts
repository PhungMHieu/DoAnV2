import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNumber,
  IsOptional,
  IsEnum,
  IsBoolean,
  Min,
} from 'class-validator';
import { CategoryType, ALL_CATEGORIES } from '../../categories/category.constants';

/**
 * DTO để log prediction với correction
 */
export class LogPredictionCorrectionDto {
  @ApiProperty({
    description: 'Original transaction text',
    example: 'ăn phở 50k',
  })
  @IsString()
  text: string;

  @ApiPropertyOptional({
    description: 'Transaction amount',
    example: 50000,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  amount?: number;

  @ApiProperty({
    description: 'Category that was predicted by the system',
    example: 'food',
  })
  @IsString()
  predictedCategory: string;

  @ApiProperty({
    description: 'Confidence of the prediction (0-1)',
    example: 0.85,
  })
  @IsNumber()
  predictedConfidence: number;

  @ApiProperty({
    description: 'The correct category (from user)',
    example: 'food',
  })
  @IsString()
  correctedCategory: string;

  @ApiPropertyOptional({
    description: 'User ID for per-user learning',
  })
  @IsOptional()
  @IsString()
  userId?: string;
}

/**
 * DTO để log confirmed prediction (user không sửa)
 */
export class LogConfirmedPredictionDto {
  @ApiProperty({
    description: 'Original transaction text',
    example: 'đi grab 30k',
  })
  @IsString()
  text: string;

  @ApiPropertyOptional({
    description: 'Transaction amount',
    example: 30000,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  amount?: number;

  @ApiProperty({
    description: 'Category that was predicted and confirmed',
    example: 'transportation',
  })
  @IsString()
  confirmedCategory: string;

  @ApiProperty({
    description: 'Confidence of the prediction (0-1)',
    example: 0.92,
  })
  @IsNumber()
  predictedConfidence: number;

  @ApiPropertyOptional({
    description: 'User ID for per-user learning',
  })
  @IsOptional()
  @IsString()
  userId?: string;
}

/**
 * Response cho training data stats
 */
export class TrainingDataStatsResponseDto {
  @ApiProperty({ example: 1500 })
  totalRecords: number;

  @ApiProperty({
    example: { food: 300, transportation: 250, shopping: 200 },
  })
  recordsByCategory: Record<string, number>;

  @ApiProperty({
    description: 'Percentage of predictions that were corrected by users',
    example: 15.5,
  })
  correctionRate: number;

  @ApiProperty({
    example: { 'enhanced-keyword-v1': 85.2, 'keyword-matcher-v1': 72.1 },
  })
  modelAccuracy: Record<string, number>;

  @ApiProperty()
  lastUpdated: Date;
}

/**
 * Response cho export training data
 */
export class TrainingDataExportResponseDto {
  @ApiProperty({ example: 1000 })
  count: number;

  @ApiProperty({
    type: 'array',
    items: {
      type: 'object',
      properties: {
        text: { type: 'string' },
        normalizedText: { type: 'string' },
        amount: { type: 'number' },
        category: { type: 'string' },
      },
    },
  })
  data: Array<{
    text: string;
    normalizedText: string;
    amount?: number;
    category: string;
  }>;
}
