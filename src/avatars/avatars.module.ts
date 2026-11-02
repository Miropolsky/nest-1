import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AvatarEntity } from './avatar.entity.js';
import { AvatarsController } from './avatars.controller.js';
import { AvatarsRepository } from './avatars.repository.js';
import { AvatarsService } from './avatars.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([AvatarEntity])],
  controllers: [AvatarsController],
  providers: [AvatarsService, AvatarsRepository],
})
export class AvatarsModule {}
