import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsNumber,
  IsString,
  Max,
  Min,
  MaxLength,
  MinLength,
} from 'class-validator';

export class WithdrawDto {
  @ApiProperty({
    minimum: 1,
    maximum: 1_000_000,
    example: 50,
    description: 'Withdrawal amount (must not exceed wallet balance)',
  })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(1)
  @Max(1_000_000)
  amount: number;

  @ApiProperty({
    minLength: 1,
    maxLength: 64,
    example: 'bank_transfer',
    description: 'Payout method identifier (integration-specific)',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  payoutMethod: string;
}
