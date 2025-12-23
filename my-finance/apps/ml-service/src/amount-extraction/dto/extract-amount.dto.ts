import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

/**
 * Request DTO for amount extraction
 */
export class ExtractAmountDto {
  @ApiProperty({
    description: 'Vietnamese text containing amount information',
    example: 'ăn phở 50000',
  })
  @IsString()
  @IsNotEmpty()
  text: string;
}

/**
 * Response DTO for amount extraction
 */
export class ExtractAmountResponseDto {
  @ApiProperty({
    description: 'Extracted amount (0 if not found)',
    example: 50000,
  })
  amount: number;

  @ApiProperty({
    description: 'Confidence score (0-1)',
    example: 0.95,
  })
  confidence: number;

  @ApiProperty({
    description: 'Original matched text from input',
    example: '50000',
    required: false,
  })
  matchedText?: string;

  @ApiProperty({
    description: 'Method used for extraction',
    example: 'regex-plain-number',
    enum: [
      'regex-complex-vietnamese',
      'regex-trieu',
      'regex-tram-nghin',
      'regex-nghin',
      'regex-k-notation',
      'regex-plain-number',
      'empty-text',
      'not-found',
      'invalid-format',
      'no-match',
    ],
  })
  method: string;
}
