import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import { PinoLogger } from 'nestjs-pino';
import {
  AVATAR_CLEANUP_JOB,
  AVATAR_CLEANUP_QUEUE,
  avatarCleanupJobOptions,
} from './avatar-cleanup.constants.js';

@Injectable()
export class AvatarCleanupService {
  constructor(
    @InjectQueue(AVATAR_CLEANUP_QUEUE) private readonly queue: Queue,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(AvatarCleanupService.name);
  }

  async enqueue() {
    const job = await this.queue.add(
      AVATAR_CLEANUP_JOB,
      {},
      avatarCleanupJobOptions,
    );

    this.logger.info({ jobId: job.id }, 'Avatar cleanup job added to queue');

    return {
      message: 'Avatar cleanup job added to queue',
      jobId: job.id,
    };
  }
}
