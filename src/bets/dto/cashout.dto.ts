import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class CashoutDto {
  @ApiProperty({
    format: 'uuid',
    example: 'b7eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
    description: 'ID of an active bet to cash out during a flying round',
  })
  @IsUUID('4')
  betId: string;
}
