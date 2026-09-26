import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class SignInDto {
  @IsString()
  @IsNotEmpty()
  @ApiProperty({
    description: 'Логин пользователя',
    example: 'Ivan',
  })
  login: string;

  @IsString()
  @IsNotEmpty()
  @ApiProperty({
    description: 'Пароль пользователя',
    example: '123456',
  })
  password: string;
}
