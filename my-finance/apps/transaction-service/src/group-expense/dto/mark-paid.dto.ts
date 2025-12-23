import { IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class MarkPaidDto {
  @ApiProperty({
    description: 'ID of the group expense share to mark as paid',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  shareId: string;
}
