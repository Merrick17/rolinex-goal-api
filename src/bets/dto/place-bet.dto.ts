import { IsNumber, IsOptional, IsUUID, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class PlaceBetDto {
  @IsUUID()
  roundId: string;

  @IsNumber()
  @Min(10)
  amount: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(1.01)
  autoCashout?: number;
}
