import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';

const MAX_AVATAR_SIZE = 10 * 1024 * 1024;
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function isJpeg(buffer: Buffer): boolean {
  return (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  );
}

function isPng(buffer: Buffer): boolean {
  return (
    buffer.length >= PNG_SIGNATURE.length &&
    PNG_SIGNATURE.every((byte, index) => buffer[index] === byte)
  );
}

@Injectable()
export class AvatarFilePipe implements PipeTransform {
  transform(value: Express.Multer.File) {
    if (!value) {
      throw new BadRequestException('File is required');
    }

    if (value.size > MAX_AVATAR_SIZE) {
      throw new BadRequestException('File size is too large (max 10MB)');
    }

    if (!isJpeg(value.buffer) && !isPng(value.buffer)) {
      throw new BadRequestException('Only JPEG and PNG files are allowed');
    }

    return value;
  }
}
