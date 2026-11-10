import {
  Controller,
  Delete,
  Param,
  ParseIntPipe,
  Post,
  UploadedFile,
  UseFilters,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { JwtPayload } from '../auth/constants.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { MAX_AVATAR_SIZE } from './avatar-file.js';
import { AvatarsService } from './avatars.service.js';
import { AvatarUploadExceptionFilter } from './filters/avatar-upload-exception.filter.js';
import { AvatarFilePipe } from './pipes/avatar-file.pipe.js';

@ApiTags('avatars')
@ApiBearerAuth()
@Controller('avatars')
export class AvatarsController {
  constructor(private readonly avatarsService: AvatarsService) {}

  @Post('/upload-avatar')
  @ApiOperation({ summary: 'Загрузить аватар текущему пользователю' })
  @ApiResponse({ status: 201, description: 'Аватар загружен' })
  @ApiResponse({
    status: 400,
    description: 'Неверный файл или уже есть 5 активных аватарок',
  })
  @ApiResponse({ status: 401, description: 'Не авторизован' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @UseFilters(AvatarUploadExceptionFilter)
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_AVATAR_SIZE } }),
  )
  uploadFile(
    @UploadedFile(AvatarFilePipe) file: Express.Multer.File,
    @CurrentUser() current: JwtPayload,
  ) {
    return this.avatarsService.uploadAvatar(file, current.sub);
  }

  @Delete('/delete-avatar/:id')
  @ApiOperation({ summary: 'Мягко удалить свою аватарку' })
  @ApiResponse({ status: 200, description: 'Аватар удалён' })
  @ApiResponse({ status: 401, description: 'Не авторизован' })
  @ApiResponse({ status: 403, description: 'Чужая аватарка' })
  @ApiResponse({ status: 404, description: 'Аватар не найден' })
  deleteAvatar(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() current: JwtPayload,
  ) {
    return this.avatarsService.deleteAvatar(id, current.sub);
  }
}
