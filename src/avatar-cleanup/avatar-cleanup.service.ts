import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import { ClsService } from 'nestjs-cls';
import { PinoLogger } from 'nestjs-pino';
import {
  resolveRequestId,
  runWithRequestId,
} from '../common/cls/run-with-request-id.js';
import {
  AVATAR_CLEANUP_JOB,
  AVATAR_CLEANUP_QUEUE,
  avatarCleanupJobOptions,
} from './avatar-cleanup.constants.js';
import type { AvatarCleanupJobData } from './avatar-cleanup.job.js';

@Injectable()
export class AvatarCleanupService {
  constructor(
    @InjectQueue(AVATAR_CLEANUP_QUEUE) private readonly queue: Queue,
    private readonly cls: ClsService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(AvatarCleanupService.name);
  }

  enqueue(requestId?: string) {
    const id = resolveRequestId(this.cls, requestId);

    return runWithRequestId(this.cls, id, async () => {
      const job = await this.queue.add(
        AVATAR_CLEANUP_JOB,
        { requestId: id } satisfies AvatarCleanupJobData,
        avatarCleanupJobOptions,
      );

      this.logger.info(
        { jobId: job.id, requestId: id },
        'Avatar cleanup job added to queue',
      );

      return {
        message: 'Avatar cleanup job added to queue',
        jobId: job.id,
      };
    });
  }
}
