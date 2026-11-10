import { Type } from 'class-transformer';
import {
  IsDecimal,
  IsInt,
  IsNotEmpty,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';

const PG_INTEGER_MAX = 2_147_483_647;

export class TransferDto {
  @IsString()
  @IsNotEmpty()
  @IsDecimal({ decimal_digits: '0,2' })
  @Matches(/^(?!0+(?:\.0{1,2})?$)\d+(?:\.\d{1,2})?$/)
  amount: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(PG_INTEGER_MAX)
  recipientId: number;
}
