import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { detectAvatarType, MAX_AVATAR_SIZE } from '../avatar-file.js';

@Injectable()
export class AvatarFilePipe implements PipeTransform {
  transform(value: Express.Multer.File) {
    if (!value) {
      throw new BadRequestException('File is required');
    }

    if (value.size > MAX_AVATAR_SIZE) {
      throw new BadRequestException('File size is too large (max 10MB)');
    }

    const detected = detectAvatarType(value.buffer);
    if (!detected) {
      throw new BadRequestException('Only JPEG and PNG files are allowed');
    }

    value.mimetype = detected.contentType;
    return value;
  }
}
