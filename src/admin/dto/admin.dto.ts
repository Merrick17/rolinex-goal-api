import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class AdminPatchUserDto {
  @IsOptional()
  @IsBoolean()
  accountFrozen?: boolean;

  /** Positive credits balance; negative debits (major currency units). */
  @IsOptional()
  @IsNumber()
  balanceDelta?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
