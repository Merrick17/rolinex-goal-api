import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class LogoutDto {
  @ApiProperty({
    minLength: 10,
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    description: 'Refresh token to invalidate (must belong to the authenticated user)',
  })
  @IsString()
  @MinLength(10)
  refreshToken: string;
}
