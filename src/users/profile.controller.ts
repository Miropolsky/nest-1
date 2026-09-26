import { Controller, Get } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { JwtPayload } from '../auth/constants.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { UserDto } from './dto/user.dto.js';
import { UsersService } from './users.service.js';

@ApiTags('profile')
@ApiBearerAuth()
@Controller('profile')
export class ProfileController {
  constructor(private readonly usersService: UsersService) {}

  @Get('my')
  @ApiOperation({ summary: 'Получить свой профиль' })
  @ApiResponse({
    status: 200,
    description: 'Профиль получен',
    type: UserDto,
  })
  @ApiResponse({ status: 401, description: 'Не авторизован' })
  @ApiResponse({ status: 404, description: 'Пользователь не найден' })
  getProfile(@CurrentUser() user: JwtPayload) {
    return this.usersService.getProfile(user.sub);
  }
}
