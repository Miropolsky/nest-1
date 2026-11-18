import type { ConfigService } from '@nestjs/config';
import type { SchedulerRegistry } from '@nestjs/schedule';
import type { Job, Queue } from 'bullmq';
import { CronJob } from 'cron';
import type { ClsService } from 'nestjs-cls';
import type { PinoLogger } from 'nestjs-pino';
import { AvatarCleanupProcessor } from '../src/avatar-cleanup/avatar-cleanup.processor.js';
import { AvatarCleanupScheduler } from '../src/avatar-cleanup/avatar-cleanup.scheduler.js';
import { AvatarCleanupService } from '../src/avatar-cleanup/avatar-cleanup.service.js';
import type { AvatarEntity } from '../src/avatars/avatar.entity.js';
import type { AvatarsRepository } from '../src/avatars/avatars.repository.js';
import type { S3Service } from '../src/providers/s3/s3.service.js';

const DAY_MS = 24 * 60 * 60 * 1000;

function logger() {
  return {
    setContext: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
}

function clsService(activeId?: string): ClsService {
  let currentId = activeId;
  return {
    isActive: vi.fn(() => Boolean(currentId)),
    getId: vi.fn(() => currentId),
    set: vi.fn((_key: unknown, value: string) => {
      currentId = value;
    }),
    run: vi.fn((callback: () => unknown) => callback()),
  } as unknown as ClsService;
}

function config(values: Record<string, string | number>): ConfigService {
  return {
    getOrThrow: vi.fn((key: string) => {
      if (!(key in values)) {
        throw new Error(key);
      }
      return values[key];
    }),
  } as unknown as ConfigService;
}

describe('очистка аватаров', () => {
  const jobs: CronJob[] = [];

  afterEach(async () => {
    await Promise.all(jobs.splice(0).map((job) => Promise.resolve(job.stop())));
  });

  it('ручной запуск ставит ту же задачу в очередь с requestId', async () => {
    const queue = {
      add: vi.fn().mockResolvedValue({ id: 'manual-1' }),
    };
    const service = new AvatarCleanupService(
      queue as unknown as Queue,
      clsService('http-request-id'),
      logger() as unknown as PinoLogger,
    );

    const accepted = await service.enqueue();

    expect(queue.add).toHaveBeenCalledWith(
      'cleanup-deleted-avatars',
      { requestId: 'http-request-id' },
      expect.objectContaining({
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
      }),
    );
    expect(accepted.jobId).toBe('manual-1');
  });

  it('ночное расписание берётся из конфига и ставит задачу в очередь', async () => {
    const enqueue = vi.fn().mockResolvedValue({ jobId: 'cron-1' });
    const registry = {
      addCronJob: vi.fn((_name: string, job: CronJob) => {
        jobs.push(job);
      }),
      doesExist: vi.fn().mockReturnValue(false),
      getCronJob: vi.fn(),
    };
    const scheduler = new AvatarCleanupScheduler(
      registry as unknown as SchedulerRegistry,
      config({ 'avatarCleanup.cron': '0 3 * * *' }),
      { enqueue } as unknown as AvatarCleanupService,
      clsService(),
      logger() as unknown as PinoLogger,
    );

    scheduler.onModuleInit();
    const job = registry.addCronJob.mock.calls[0]?.[1] as CronJob;
    await job.fireOnTick();

    expect(registry.addCronJob).toHaveBeenCalledWith(
      'avatar-cleanup-nightly',
      expect.any(CronJob),
    );
    expect(job.cronTime.toString()).toContain('0 3 * * *');
    expect(enqueue).toHaveBeenCalledTimes(1);
  });

  it('удаляет только аватар, помеченный удалённым больше 7 дней назад', async () => {
    const now = Date.now();
    const stored = [
      avatar(1, 'avatars/active.jpg', null),
      avatar(2, 'avatars/yesterday.jpg', new Date(now - DAY_MS)),
      avatar(3, 'avatars/expired.jpg', new Date(now - 8 * DAY_MS)),
    ];
    const repository = memoryRepository(stored);
    const s3 = { remove: vi.fn().mockResolvedValue(undefined) };
    const processor = createProcessor(repository, s3);

    await processor.process(cleanupJob());

    expect(s3.remove).toHaveBeenCalledTimes(1);
    expect(s3.remove).toHaveBeenCalledWith('avatars/expired.jpg');
    expect(repository.hardDelete).toHaveBeenCalledTimes(1);
    expect(repository.hardDelete).toHaveBeenCalledWith(3);
    expect(stored.map((item) => item.id)).toEqual([1, 2]);
  });

  it('оставляет запись в базе, если MinIO недоступен', async () => {
    const stored = [
      avatar(3, 'avatars/expired.jpg', new Date(Date.now() - 8 * DAY_MS)),
    ];
    const repository = memoryRepository(stored);
    const s3 = {
      remove: vi.fn().mockRejectedValue(new Error('MinIO unavailable')),
    };
    const processor = createProcessor(repository, s3);

    await expect(processor.process(cleanupJob())).rejects.toThrow(
      'Failed to cleanup 1 avatars',
    );
    expect(repository.hardDelete).not.toHaveBeenCalled();
    expect(stored).toHaveLength(1);
  });

  it('дочищает запись, если объекта в хранилище уже нет', async () => {
    const stored = [
      avatar(3, 'avatars/expired.jpg', new Date(Date.now() - 8 * DAY_MS)),
    ];
    const repository = memoryRepository(stored);
    const s3 = {
      remove: vi
        .fn()
        .mockRejectedValue(
          Object.assign(new Error('missing'), { name: 'NoSuchKey' }),
        ),
    };
    const processor = createProcessor(repository, s3);

    await processor.process(cleanupJob());

    expect(repository.hardDelete).toHaveBeenCalledWith(3);
    expect(stored).toHaveLength(0);
  });

  it('удаляет orphan-объект без записи в БД', async () => {
    const s3 = { remove: vi.fn().mockResolvedValue(undefined) };
    const processor = createProcessor(memoryRepository([]), s3);

    await processor.process({
      id: 'orphan-1',
      name: 'remove-orphan-avatar',
      data: {
        fileName: 'avatars/orphan.jpg',
        userId: 7,
        requestId: 'orphan-request-id',
      },
    } as Job);

    expect(s3.remove).toHaveBeenCalledWith('avatars/orphan.jpg');
  });

  it('пишет в лог число удалённых и число ошибок и обрабатывает пачками', async () => {
    const stored = Array.from({ length: 101 }, (_, index) =>
      avatar(
        index + 1,
        `avatars/${index + 1}.jpg`,
        new Date(Date.now() - 8 * DAY_MS),
      ),
    );
    stored.push(
      avatar(102, 'avatars/broken.jpg', new Date(Date.now() - 9 * DAY_MS)),
    );
    const repository = memoryRepository(stored);
    const log = logger();
    const s3 = {
      remove: vi.fn(async (fileName: string) => {
        if (fileName === 'avatars/broken.jpg') {
          throw new Error('MinIO unavailable');
        }
      }),
    };
    const processor = new AvatarCleanupProcessor(
      repository as unknown as AvatarsRepository,
      s3 as unknown as S3Service,
      config({ 'avatarCleanup.retentionDays': 7 }),
      clsService(),
      log as unknown as PinoLogger,
    );

    await expect(processor.process(cleanupJob())).rejects.toThrow(
      'Failed to cleanup 1 avatars',
    );

    expect(repository.findDeletedBefore).toHaveBeenCalledTimes(2);
    expect(repository.hardDelete).toHaveBeenCalledTimes(101);
    expect(log.info).toHaveBeenCalledWith(
      { jobId: 'job-1', deleted: 101, failed: 1 },
      'Avatar cleanup finished',
    );
    expect(stored.map((item) => item.id)).toEqual([102]);
  });
});

function createProcessor(
  repository: ReturnType<typeof memoryRepository>,
  s3: { remove: ReturnType<typeof vi.fn> },
) {
  return new AvatarCleanupProcessor(
    repository as unknown as AvatarsRepository,
    s3 as unknown as S3Service,
    config({ 'avatarCleanup.retentionDays': 7 }),
    clsService(),
    logger() as unknown as PinoLogger,
  );
}

function cleanupJob(): Job {
  return {
    id: 'job-1',
    name: 'cleanup-deleted-avatars',
    data: { requestId: 'job-request-id' },
  } as Job;
}

function avatar(
  id: number,
  fileName: string,
  deletedAt: Date | null,
): AvatarEntity {
  return { id, fileName, deletedAt } as AvatarEntity;
}

function memoryRepository(stored: AvatarEntity[]) {
  return {
    findDeletedBefore: vi.fn(
      async (cutoff: Date, afterId: number, limit: number) =>
        stored
          .filter(
            (item) =>
              item.deletedAt !== null &&
              item.deletedAt < cutoff &&
              item.id > afterId,
          )
          .sort((left, right) => left.id - right.id)
          .slice(0, limit),
    ),
    hardDelete: vi.fn(async (id: number) => {
      const index = stored.findIndex((item) => item.id === id);
      if (index >= 0) {
        stored.splice(index, 1);
      }
    }),
  };
}
