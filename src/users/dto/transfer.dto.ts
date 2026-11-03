import { IsDecimal, IsNotEmpty, IsString, Matches } from 'class-validator';

export class TransferDto {
  @IsString()
  @IsNotEmpty()
  @IsDecimal({ decimal_digits: '0,2' })
  @Matches(/^(?!0+(?:\.0{1,2})?$)\d+(?:\.\d{1,2})?$/)
  amount: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^[1-9]\d*$/)
  recipientId: string;
}
