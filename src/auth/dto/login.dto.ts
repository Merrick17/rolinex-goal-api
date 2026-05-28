import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({
    format: 'email',
    example: 'player@example.com',
    description: 'Registered account email',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    format: 'password',
    minLength: 8,
    maxLength: 256,
    example: 'SecurePass1',
    description: 'Account password (min 8 characters)',
  })
  @IsString()
  @MinLength(8)
  @MaxLength(256)
  password: string;
}
