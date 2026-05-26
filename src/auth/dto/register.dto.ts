import {
  IsEmail,
  IsOptional,
  IsString,
  Length,
  Matches,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @Length(8)
  @Matches(/^(?=.*[A-Z])(?=.*\d)/, {
    message:
      'Password must contain at least one uppercase letter and one number',
  })
  password: string;

  @IsString()
  @Length(3, 20)
  @Matches(/^[a-zA-Z0-9_]+$/, {
    message:
      'Username can only contain alphanumeric characters and underscores',
  })
  username: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  referralCode?: string;
}
