import { BadRequestException } from '@nestjs/common';
import { MAX_AVATAR_SIZE } from '../src/avatars/avatar-file.js';
import { AvatarFilePipe } from '../src/avatars/pipes/avatar-file.pipe.js';

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0x00]);
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function file(buffer: Buffer, size = buffer.length): Express.Multer.File {
  return {
    buffer,
    size,
    mimetype: 'application/octet-stream',
  } as Express.Multer.File;
}

describe('AvatarFilePipe', () => {
  const pipe = new AvatarFilePipe();

  it('отклоняет запрос без файла', () => {
    expect(() =>
      pipe.transform(undefined as unknown as Express.Multer.File),
    ).toThrow(BadRequestException);
  });

  it('отклоняет файл больше 10 Мбайт', () => {
    expect(() => pipe.transform(file(JPEG, MAX_AVATAR_SIZE + 1))).toThrow(
      'File size is too large (max 10MB)',
    );
  });

  it('отклоняет файл, который не JPEG и не PNG', () => {
    expect(() => pipe.transform(file(Buffer.from('not-an-image')))).toThrow(
      'Only JPEG and PNG files are allowed',
    );
  });

  it('принимает JPEG по содержимому и ставит image/jpeg', () => {
    const uploaded = pipe.transform(file(JPEG));

    expect(uploaded.mimetype).toBe('image/jpeg');
  });

  it('принимает PNG по содержимому и ставит image/png', () => {
    const uploaded = pipe.transform(file(PNG));

    expect(uploaded.mimetype).toBe('image/png');
  });
});
