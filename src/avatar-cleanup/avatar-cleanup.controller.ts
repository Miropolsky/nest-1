import { Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AvatarCleanupService } from './avatar-cleanup.service.js';

@ApiTags('avatars')
@ApiBearerAuth()
@Controller('avatars')
export class AvatarCleanupController {
  constructor(private readonly avatarCleanupService: AvatarCleanupService) {}

  @Post('cleanup')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Поставить в очередь очистку удалённых аватаров',
  })
  @ApiResponse({
    status: HttpStatus.ACCEPTED,
    description: 'Задача очистки добавлена в очередь',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Не авторизован',
  })
  enqueue() {
    return this.avatarCleanupService.enqueue();
  }
}
