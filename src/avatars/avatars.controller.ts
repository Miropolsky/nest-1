import {
  Controller,
  Delete,
  Param,
  ParseIntPipe,
  Post,
  UploadedFile,
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
import { AvatarsService } from './avatars.service.js';
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
  @UseInterceptors(FileInterceptor('file'))
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
