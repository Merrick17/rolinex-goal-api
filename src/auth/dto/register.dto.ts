import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @ApiProperty({
    format: 'email',
    example: 'player@example.com',
    description: 'Unique email for the new account',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    format: 'password',
    minLength: 8,
    maxLength: 128,
    example: 'SecurePass1',
    description:
      'Password: at least 8 characters, one uppercase letter, and one digit',
  })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  @Matches(/^(?=.*[A-Z])(?=.*\d)/, {
    message:
      'Password must contain at least one uppercase letter and one number',
  })
  password: string;

  @ApiProperty({
    minLength: 3,
    maxLength: 20,
    pattern: '^[a-zA-Z0-9_]+$',
    example: 'goal_striker_01',
    description: 'Unique public username (3–20 chars: letters, digits, underscore)',
  })
  @IsString()
  @Length(3, 20)
  @Matches(/^[a-zA-Z0-9_]+$/, {
    message:
      'Username can only contain alphanumeric characters and underscores',
  })
  username: string;

  @ApiPropertyOptional({
    maxLength: 32,
    example: 'PROLINEX-AB12CD34',
    description: 'Optional referral code from an existing user',
  })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  referralCode?: string;
}
