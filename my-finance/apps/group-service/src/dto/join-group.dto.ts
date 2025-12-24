import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class JoinGroupDto {
  @ApiProperty({
    description: 'Unique code of the group to join',
    example: 'ABC123',
    type: String,
  })
  @IsString()
  @IsNotEmpty({ message: 'groupCode is required' })
  groupCode: string;

  @ApiProperty({
    description: 'Display name for this member in the group',
    example: 'Alice',
    type: String,
  })
  @IsString()
  @IsNotEmpty({ message: 'memberName is required' })
  memberName: string;
}
