import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsNumber,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  @ApiProperty({
    description: 'Логин пользователя',
    example: 'Ivan',
  })
  login: string;

  @IsEmail()
  @IsNotEmpty()
  @ApiProperty({
    description: 'Email пользователя',
    example: 'ivan@example.com',
  })
  email: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @ApiProperty({
    description: 'Пароль пользователя (минимум 8 символов)',
    example: 'password1',
    minLength: 8,
  })
  password: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(1000, {
    message: 'Description must be less than 1000 characters',
  })
  @ApiProperty({
    description: 'Описание',
    example: 'Описание',
  })
  description: string;

  @IsNumber()
  @IsNotEmpty()
  @Min(0)
  @Max(100)
  @ApiProperty({
    description: 'Возраст пользователя',
    example: 20,
  })
  age: number;
}
