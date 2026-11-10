import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class FindActiveUsersQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  @ApiPropertyOptional({
    description: 'Минимальный возраст',
    example: 18,
  })
  minAge?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  @ApiPropertyOptional({
    description: 'Максимальный возраст',
    example: 40,
  })
  maxAge?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @ApiPropertyOptional({
    description: 'Номер страницы',
    example: 1,
    default: 1,
  })
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @ApiPropertyOptional({
    description: 'Сколько пользователей вернуть',
    example: 10,
    default: 10,
  })
  limit?: number = 10;
}
