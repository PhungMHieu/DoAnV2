import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsArray, ArrayMinSize, ArrayNotEmpty } from 'class-validator';

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

  @ApiProperty({
    description: 'Array of member names to add to the group',
    example: ['John Doe', 'Jane Smith', 'Bob Wilson'],
    type: [String],
    isArray: true,
    minItems: 1,
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'memberNames must be a non-empty array' })
  @ArrayNotEmpty({ message: 'memberNames must be a non-empty array' })
  @IsString({ each: true, message: 'memberNames must be array of strings' })
  @IsNotEmpty({ each: true, message: 'memberNames must be array of non-empty strings' })
  memberNames: string[];
}
