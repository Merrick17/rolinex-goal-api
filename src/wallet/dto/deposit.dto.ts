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

export class DepositDto {
  @ApiProperty({
    minimum: 1,
    maximum: 1_000_000,
    example: 100,
    description: 'Deposit amount (major currency units, e.g. USD)',
  })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(1)
  @Max(1_000_000)
  amount: number;

  @ApiProperty({
    minLength: 1,
    maxLength: 64,
    example: 'card',
    description: 'Payment method identifier (integration-specific)',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  paymentMethod: string;
}
