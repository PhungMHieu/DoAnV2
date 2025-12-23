import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, Min, Max, IsOptional } from 'class-validator';

/**
 * Request DTO cho expense forecasting
 */
export class ForecastExpenseDto {
  @ApiProperty({
    description: 'User ID to forecast for',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsString()
  userId: string;

  @ApiProperty({
    description: 'Number of months to forecast into the future',
    example: 3,
    minimum: 1,
    maximum: 12,
  })
  @IsNumber()
  @Min(1)
  @Max(12)
  monthsAhead: number;

  @ApiProperty({
    description: 'Category to forecast (optional, if not provided forecasts all)',
    example: 'food',
    required: false,
  })
  @IsOptional()
  @IsString()
  category?: string;
}

/**
 * Single month forecast
 */
export class MonthForecast {
  @ApiProperty({
    description: 'Month in MM/YYYY format',
    example: '01/2026',
  })
  month: string;

  @ApiProperty({
    description: 'Predicted expense amount',
    example: 5500000,
  })
  predicted: number;

  @ApiProperty({
    description: 'Lower bound of confidence interval (95%)',
    example: 4950000,
  })
  lowerBound: number;

  @ApiProperty({
    description: 'Upper bound of confidence interval (95%)',
    example: 6050000,
  })
  upperBound: number;

  @ApiProperty({
    description: 'Trend indicator',
    enum: ['increasing', 'decreasing', 'stable'],
    example: 'increasing',
  })
  trend: 'increasing' | 'decreasing' | 'stable';

  @ApiProperty({
    description: 'Breakdown by category (if available)',
    example: {
      food: 2000000,
      transport: 1500000,
      entertainment: 1000000,
      other: 1000000,
    },
    required: false,
  })
  breakdown?: Record<string, number>;
}

/**
 * Response DTO cho expense forecast
 */
export class ForecastResponseDto {
  @ApiProperty({
    description: 'User ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  userId: string;

  @ApiProperty({
    description: 'Array of monthly forecasts',
    type: [MonthForecast],
  })
  forecasts: MonthForecast[];

  @ApiProperty({
    description: 'Historical data used for forecasting',
    example: {
      months: ['10/2024', '11/2024', '12/2024'],
      expenses: [5000000, 5200000, 5400000],
    },
  })
  historical: {
    months: string[];
    expenses: number[];
  };

  @ApiProperty({
    description: 'Model metadata',
    example: {
      model: 'moving-average-v1',
      accuracy: 0.85,
      dataPoints: 12,
    },
  })
  metadata: {
    model: string;
    accuracy: number;
    dataPoints: number;
  };

  @ApiProperty({
    description: 'Insights and recommendations',
    example: [
      'Chi tiêu tăng trung bình 4% mỗi tháng',
      'Dự kiến chi tiêu cao nhất vào tháng 3 (Tết)',
    ],
  })
  insights: string[];
}
