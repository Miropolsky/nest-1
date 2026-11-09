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
    vi.resetAllMocks();
    dataSource.transaction.mockImplementation(
      async (work: (trx: EntityManager) => Promise<unknown>) => work(manager),
    );
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

  it('загружает файл вне транзакции и сохраняет ключ после повторной проверки лимита', async () => {
    repository.countActive.mockResolvedValue(1);
    s3.upload.mockResolvedValue('avatars/new.jpg');

    await expect(service.uploadAvatar(uploaded, 7)).resolves.toBe(
      'avatars/new.jpg',
    );

    expect(s3.upload.mock.invocationCallOrder[0]).toBeGreaterThan(
      repository.lockUser.mock.invocationCallOrder[0],
    );
    expect(repository.save.mock.invocationCallOrder[0]).toBeGreaterThan(
      s3.upload.mock.invocationCallOrder[0],
    );
    expect(repository.save).toHaveBeenCalledWith(
      { userId: 7, fileName: 'avatars/new.jpg' },
      manager,
    );
    expect(s3.remove).not.toHaveBeenCalled();
  });

  it('удаляет объект, если запись в транзакции не сохранилась', async () => {
    repository.countActive.mockResolvedValue(1);
    s3.upload.mockResolvedValue('avatars/new.jpg');
    repository.save.mockRejectedValue(new Error('insert failed'));

    await expect(service.uploadAvatar(uploaded, 7)).rejects.toThrow(
      'insert failed',
    );
    expect(s3.remove).toHaveBeenCalledWith('avatars/new.jpg');
  });

  it('удаляет объект, если транзакция не зафиксировалась после save', async () => {
    repository.countActive.mockResolvedValue(1);
    s3.upload.mockResolvedValue('avatars/new.jpg');
    dataSource.transaction
      .mockImplementationOnce(
        async (work: (trx: EntityManager) => Promise<unknown>) => work(manager),
      )
      .mockImplementationOnce(
        async (work: (trx: EntityManager) => Promise<unknown>) => {
          await work(manager);
          throw new Error('commit failed');
        },
      );

    await expect(service.uploadAvatar(uploaded, 7)).rejects.toThrow(
      'commit failed',
    );
    expect(repository.save).toHaveBeenCalled();
    expect(s3.remove).toHaveBeenCalledWith('avatars/new.jpg');
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
