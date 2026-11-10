import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { ClsService } from 'nestjs-cls';
import { PinoLogger } from 'nestjs-pino';
import { randomUUID } from 'node:crypto';
import { runWithRequestId } from '../common/cls/run-with-request-id.js';
import { AVATAR_CLEANUP_CRON_NAME } from './avatar-cleanup.constants.js';
import { AvatarCleanupService } from './avatar-cleanup.service.js';

@Injectable()
export class AvatarCleanupScheduler implements OnModuleInit, OnModuleDestroy {
  constructor(
    private readonly schedulerRegistry: SchedulerRegistry,
    private readonly config: ConfigService,
    private readonly avatarCleanupService: AvatarCleanupService,
    private readonly cls: ClsService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(AvatarCleanupScheduler.name);
  }

  onModuleInit(): void {
    const cronTime = this.config.getOrThrow<string>('avatarCleanup.cron');
    const job = new CronJob(cronTime, () => this.enqueueScheduledCleanup());

    this.schedulerRegistry.addCronJob(AVATAR_CLEANUP_CRON_NAME, job);
    job.start();

    runWithRequestId(this.cls, randomUUID(), () => {
      this.logger.info({ cronTime }, 'Avatar cleanup schedule registered');
    });
  }

  async onModuleDestroy(): Promise<void> {
    if (!this.schedulerRegistry.doesExist('cron', AVATAR_CLEANUP_CRON_NAME)) {
      return;
    }

    const job = this.schedulerRegistry.getCronJob(AVATAR_CLEANUP_CRON_NAME);
    await job.stop();
  }

  private async enqueueScheduledCleanup(): Promise<void> {
    await runWithRequestId(this.cls, randomUUID(), async () => {
      try {
        await this.avatarCleanupService.enqueue();
      } catch (error) {
        this.logger.error(
          { name: error instanceof Error ? error.name : 'UnknownError' },
          'Failed to enqueue avatar cleanup',
        );
      }
    });
  }
}
