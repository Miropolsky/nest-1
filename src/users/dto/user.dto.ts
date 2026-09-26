import { ApiProperty } from '@nestjs/swagger';

export class UserDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'Ivan' })
  login: string;

  @ApiProperty({ example: 'ivan@example.com' })
  email: string;

  @ApiProperty({ example: 'О себе' })
  description: string;

  @ApiProperty({ example: 20 })
  age: number;
}
