import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export const USER_SORT_FIELDS = ['login', 'email', 'age'] as const;
export type UserSortField = (typeof USER_SORT_FIELDS)[number];

export const SORT_ORDERS = ['ASC', 'DESC'] as const;
export type SortOrder = (typeof SORT_ORDERS)[number];

export class FindUsersQueryDto {
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
    description: 'Количество пользователей на странице',
    example: 10,
    default: 10,
  })
  limit?: number = 10;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({
    description: 'Фильтр по логину (частичное совпадение)',
    example: 'Ivan',
  })
  login?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({
    description: 'Фильтр по email (частичное совпадение)',
    example: 'ivan@example.com',
  })
  email?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  @ApiPropertyOptional({
    description: 'Фильтр по возрасту (точное совпадение)',
    example: 20,
  })
  age?: number;

  @IsOptional()
  @IsIn(USER_SORT_FIELDS)
  @ApiPropertyOptional({
    description: 'Поле для сортировки',
    enum: USER_SORT_FIELDS,
    example: 'login',
    default: 'login',
  })
  sortBy?: UserSortField = 'login';

  @IsOptional()
  @IsIn(SORT_ORDERS)
  @ApiPropertyOptional({
    description: 'Порядок сортировки',
    enum: SORT_ORDERS,
    example: 'ASC',
    default: 'ASC',
  })
  sortOrder?: SortOrder = 'ASC';
}
