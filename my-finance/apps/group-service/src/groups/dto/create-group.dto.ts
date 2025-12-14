import { IsArray, ArrayMinSize, IsNotEmpty, IsString } from 'class-validator';

export class CreateGroupDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  ownerName: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  memberNames: string[];
}
