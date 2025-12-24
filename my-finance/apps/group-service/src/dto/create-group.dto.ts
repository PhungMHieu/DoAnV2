import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class CreateGroupDto {
  @ApiProperty({
    description: 'Name of the group',
    example: 'Family Budget Group',
    type: String,
  })
  @IsString()
  @IsNotEmpty({ message: 'name is required' })
  name: string;

  @ApiProperty({
    description: 'Display name of the group owner/creator',
    example: 'Admin User',
    type: String,
  })
  @IsString()
  @IsNotEmpty({ message: 'ownerName is required' })
  ownerName: string;
}
