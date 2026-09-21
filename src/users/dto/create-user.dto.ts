import {
  IsEmail,
  IsNotEmpty,
  IsNumber,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  login: string;

  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  password: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(1000, {
    message: 'Description must be less than 1000 characters',
  })
  description: string;

  @IsNumber()
  @IsNotEmpty()
  @Min(0)
  @Max(100)
  age: number;
}
