import { Processor, WorkerHost } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { Job } from 'bullmq';
import { ClsService } from 'nestjs-cls';
import { PinoLogger } from 'nestjs-pino';
import { randomUUID } from 'node:crypto';
import { AvatarsRepository } from '../avatars/avatars.repository.js';
import { runWithRequestId } from '../common/cls/run-with-request-id.js';
import { S3Service } from '../providers/s3/s3.service.js';
import {
  AVATAR_CLEANUP_BATCH_SIZE,
  AVATAR_CLEANUP_JOB,
  AVATAR_CLEANUP_QUEUE,
  AVATAR_ORPHAN_REMOVE_JOB,
} from './avatar-cleanup.constants.js';
import type {
  AvatarCleanupJobData,
  AvatarOrphanRemoveJobData,
} from './avatar-cleanup.job.js';

@Processor(AVATAR_CLEANUP_QUEUE)
export class AvatarCleanupProcessor extends WorkerHost {
  constructor(
    private readonly avatarsRepository: AvatarsRepository,
    private readonly s3Service: S3Service,
    private readonly config: ConfigService,
    private readonly cls: ClsService,
    private readonly logger: PinoLogger,
  ) {
    super();
    this.logger.setContext(AvatarCleanupProcessor.name);
  }

  process(
    job: Job<AvatarCleanupJobData | AvatarOrphanRemoveJobData>,
  ): Promise<void> {
    if (job.name === AVATAR_ORPHAN_REMOVE_JOB) {
      const orphanJob = job as Job<AvatarOrphanRemoveJobData>;
      const requestId = orphanJob.data?.requestId || randomUUID();

      return runWithRequestId(this.cls, requestId, () =>
        this.removeOrphan(orphanJob),
      );
    }

    if (job.name !== AVATAR_CLEANUP_JOB) {
      throw new Error(`Unknown job: ${job.name}`);
    }

    const cleanupJob = job as Job<AvatarCleanupJobData>;
    const requestId = cleanupJob.data?.requestId || randomUUID();

    return runWithRequestId(this.cls, requestId, () =>
      this.cleanupAvatars(cleanupJob),
    );
  }

  private async removeOrphan(
    job: Job<AvatarOrphanRemoveJobData>,
  ): Promise<void> {
    const { fileName, userId, requestId } = job.data;

    this.logger.info(
      { jobId: job.id, fileName, userId, requestId },
      'Removing orphan avatar object',
    );

    try {
      await this.s3Service.remove(fileName);
    } catch (error) {
      if (isMissingObject(error)) {
        this.logger.warn(
          { jobId: job.id, fileName },
          'Orphan avatar object already removed',
        );
        return;
      }

      throw error;
    }
  }

  private async cleanupAvatars(job: Job<AvatarCleanupJobData>): Promise<void> {
    const retentionDays = this.config.getOrThrow<number>(
      'avatarCleanup.retentionDays',
    );
    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

    this.logger.info(
      { jobId: job.id, retentionDays, requestId: job.data.requestId },
      'Starting avatar cleanup',
    );

    let deleted = 0;
    let failed = 0;
    let afterId = 0;

    while (true) {
      const avatars = await this.avatarsRepository.findDeletedBefore(
        cutoff,
        afterId,
        AVATAR_CLEANUP_BATCH_SIZE,
      );
      if (avatars.length === 0) {
        break;
      }

      for (const avatar of avatars) {
        afterId = avatar.id;
        try {
          await this.removeObject(avatar.id, avatar.fileName);
          await this.avatarsRepository.hardDelete(avatar.id);
          deleted += 1;
        } catch (error) {
          failed += 1;
          this.logger.error(
            {
              jobId: job.id,
              avatarId: avatar.id,
              name: error instanceof Error ? error.name : 'UnknownError',
            },
            'Avatar cleanup failed',
          );
        }
      }

      if (avatars.length < AVATAR_CLEANUP_BATCH_SIZE) {
        break;
      }
    }

    this.logger.info(
      { jobId: job.id, deleted, failed },
      'Avatar cleanup finished',
    );

    if (failed > 0) {
      throw new Error(`Failed to cleanup ${failed} avatars`);
    }
  }

  private async removeObject(
    avatarId: number,
    fileName: string,
  ): Promise<void> {
    try {
      await this.s3Service.remove(fileName);
    } catch (error) {
      if (!isMissingObject(error)) {
        throw error;
      }

      this.logger.warn({ avatarId }, 'Avatar object already removed');
    }
  }
}

function isMissingObject(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) {
    return false;
  }

  const candidate = error as { name?: string; Code?: string; code?: string };
  const code = candidate.name ?? candidate.Code ?? candidate.code;
  return code === 'NoSuchKey' || code === 'NotFound';
}
