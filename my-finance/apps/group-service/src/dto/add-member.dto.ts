import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class AddMemberDto {
  @ApiProperty({
    description: 'Display name for the member in this group',
    example: 'John Doe',
  })
  @IsString()
  @IsNotEmpty({ message: 'memberName is required' })
  memberName: string;

  @ApiPropertyOptional({
    description: 'User ID if linking to an existing user (optional)',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsString()
  @IsOptional()
  userId?: string;
}
