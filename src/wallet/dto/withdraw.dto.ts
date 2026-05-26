import { IsNumber, IsString, Min } from 'class-validator';

export class WithdrawDto {
  @IsNumber()
  @Min(1)
  amount: number;

  @IsString()
  payoutMethod: string;
}
