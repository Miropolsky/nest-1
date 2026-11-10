import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AVATAR_CLEANUP_QUEUE } from '../avatar-cleanup/avatar-cleanup.constants.js';
import { AvatarEntity } from './avatar.entity.js';
import { AvatarsController } from './avatars.controller.js';
import { AvatarsRepository } from './avatars.repository.js';
import { AvatarsService } from './avatars.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([AvatarEntity]),
    BullModule.registerQueue({
      name: AVATAR_CLEANUP_QUEUE,
    }),
  ],
  controllers: [AvatarsController],
  providers: [AvatarsService, AvatarsRepository],
  exports: [AvatarsRepository],
})
export class AvatarsModule {}
