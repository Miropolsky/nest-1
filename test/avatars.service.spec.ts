import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import type { PinoLogger } from 'nestjs-pino';
import type { DataSource, EntityManager } from 'typeorm';
import type { AvatarsRepository } from '../src/avatars/avatars.repository.js';
import { AvatarsService } from '../src/avatars/avatars.service.js';
import type { S3Service } from '../src/providers/s3/s3.service.js';

const manager = {} as EntityManager;

function logger(): PinoLogger {
  return {
    setContext: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  } as unknown as PinoLogger;
}

describe('AvatarsService', () => {
  const repository = {
    lockUser: vi.fn(),
    countActive: vi.fn(),
    save: vi.fn(),
    findActiveById: vi.fn(),
    softDelete: vi.fn(),
  };
  const s3 = { upload: vi.fn(), remove: vi.fn() };
  const dataSource = {
    transaction: vi.fn(async (work: (trx: EntityManager) => Promise<unknown>) =>
      work(manager),
    ),
  };

  const service = new AvatarsService(
    s3 as unknown as S3Service,
    repository as unknown as AvatarsRepository,
    dataSource as unknown as DataSource,
    logger(),
  );

  const uploaded = {
    buffer: Buffer.from('file'),
    size: 4,
  } as Express.Multer.File;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('не сохраняет шестой аватар и берёт блокировку до подсчёта', async () => {
    repository.countActive.mockResolvedValue(5);

    await expect(service.uploadAvatar(uploaded, 7)).rejects.toBeInstanceOf(
      BadRequestException,
    );

    expect(repository.lockUser).toHaveBeenCalledWith(7, manager);
    expect(repository.lockUser.mock.invocationCallOrder[0]).toBeLessThan(
      repository.countActive.mock.invocationCallOrder[0],
    );
    expect(s3.upload).not.toHaveBeenCalled();
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('удаляет только аватар владельца', async () => {
    repository.findActiveById.mockResolvedValue({ id: 3, userId: 7 });

    await service.deleteAvatar(3, 7);

    expect(repository.softDelete).toHaveBeenCalledWith(3);
  });

  it('запрещает удалять чужой аватар', async () => {
    repository.findActiveById.mockResolvedValue({ id: 3, userId: 8 });

    await expect(service.deleteAvatar(3, 7)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(repository.softDelete).not.toHaveBeenCalled();
  });

  it('возвращает 404, если активный аватар не найден', async () => {
    repository.findActiveById.mockResolvedValue(null);

    await expect(service.deleteAvatar(3, 7)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
