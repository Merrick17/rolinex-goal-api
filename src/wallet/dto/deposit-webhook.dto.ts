import { IsString, MinLength } from 'class-validator';

export class DepositWebhookDto {
  @IsString()
  @MinLength(10)
  transactionId!: string;

  @IsString()
  @MinLength(8)
  eventId!: string;
}
