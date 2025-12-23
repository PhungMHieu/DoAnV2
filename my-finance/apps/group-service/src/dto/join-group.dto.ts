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
    description: 'ID of the member slot to occupy in the group',
    example: '1',
    type: String,
  })
  @IsString()
  @IsNotEmpty({ message: 'memberId is required' })
  memberId: string;
}
