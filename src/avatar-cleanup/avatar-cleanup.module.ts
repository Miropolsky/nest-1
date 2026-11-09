import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { AvatarsModule } from '../avatars/avatars.module.js';
import { AVATAR_CLEANUP_QUEUE } from './avatar-cleanup.constants.js';
import { AvatarCleanupController } from './avatar-cleanup.controller.js';
import { AvatarCleanupProcessor } from './avatar-cleanup.processor.js';
import { AvatarCleanupScheduler } from './avatar-cleanup.scheduler.js';
import { AvatarCleanupService } from './avatar-cleanup.service.js';

@Module({
  imports: [
    AvatarsModule,
    BullModule.registerQueue({
      name: AVATAR_CLEANUP_QUEUE,
    }),
  ],
  controllers: [AvatarCleanupController],
  providers: [
    AvatarCleanupService,
    AvatarCleanupScheduler,
    AvatarCleanupProcessor,
  ],
})
export class AvatarCleanupModule {}
