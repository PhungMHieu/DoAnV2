import { Type } from 'class-transformer';
import { IsString, IsNumber, IsDateString, IsOptional, ValidateNested } from 'class-validator';

// Dữ liệu giao dịch cơ bản
export class TransactionDataDto {
  @IsNumber()
  amount: number;

  @IsString()
  category: string;

  @IsDateString()
  dateTime: string;
}

// Unified Event DTO
// - Created: chỉ có after
// - Deleted: chỉ có before
// - Updated: có cả before và after
export class TransactionEventDto {
  @IsString()
  userId: string;

  @IsString()
  transactionId: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => TransactionDataDto)
  before?: TransactionDataDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => TransactionDataDto)
  after?: TransactionDataDto;
}
