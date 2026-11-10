import { ApiProperty } from '@nestjs/swagger';

export class LatestAvatarDto {
  @ApiProperty({ example: 3 })
  id: number;

  @ApiProperty({ example: '4f2c1d0e-6b7a-4c2e-9f10-1a2b3c4d5e6f.png' })
  fileName: string;

  @ApiProperty({ example: '2026-11-03T00:00:00.000Z' })
  uploadedAt: Date;
}

export class ActiveUserDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'Ivan' })
  login: string;

  @ApiProperty({ example: 'Описание пользователя' })
  description: string;

  @ApiProperty({ example: 20 })
  age: number;

  @ApiProperty({ type: LatestAvatarDto })
  latestAvatar: LatestAvatarDto;
}
