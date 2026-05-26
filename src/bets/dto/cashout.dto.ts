import { IsString } from 'class-validator';

export class CashoutDto {
  @IsString()
  betId: string;
}
