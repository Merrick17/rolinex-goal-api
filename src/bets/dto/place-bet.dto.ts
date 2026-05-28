import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsNumber,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class PlaceBetDto {
  @ApiProperty({
    format: 'uuid',
    example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    description: 'Target round ID (must be in waiting state)',
  })
  @IsUUID('4')
  roundId: string;

  @ApiProperty({
    minimum: 10,
    maximum: 5000,
    example: 50,
    description: 'Bet stake amount (min 10, max 5000)',
  })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(10)
  @Max(5000)
  amount: number;

  @ApiPropertyOptional({
    minimum: 1.01,
    maximum: 1_000_000,
    example: 2.5,
    description: 'Optional auto cash-out multiplier (min 1.01 when set)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(1.01)
  @Max(1_000_000)
  autoCashout?: number;
}
