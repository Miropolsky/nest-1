import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { DataSource } from 'typeorm';
import { S3Service } from '../providers/s3/s3.service.js';
import { AvatarsRepository } from './avatars.repository.js';

const MAX_ACTIVE_AVATARS = 5;

@Injectable()
export class AvatarsService {
  constructor(
    private readonly s3Service: S3Service,
    private readonly avatarsRepository: AvatarsRepository,
    private readonly dataSource: DataSource,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(AvatarsService.name);
  }

  async uploadAvatar(
    file: Express.Multer.File,
    userId: number,
  ): Promise<string> {
    const fileName = await this.dataSource.transaction(async (manager) => {
      await this.avatarsRepository.lockUser(userId, manager);
      const activeCount = await this.avatarsRepository.countActive(
        userId,
        manager,
      );
      if (activeCount >= MAX_ACTIVE_AVATARS) {
        this.logger.warn(
          { userId, activeCount },
          'Avatar upload rejected: limit reached',
        );
        throw new BadRequestException('You can have at most 5 active avatars');
      }

      const uploadedName = await this.s3Service.upload(file);

      try {
        await this.avatarsRepository.save(
          { userId, fileName: uploadedName },
          manager,
        );
      } catch (error) {
        await this.removeUploadedFile(uploadedName, userId);
        this.logger.error(
          {
            userId,
            name: error instanceof Error ? error.name : 'UnknownError',
          },
          'Avatar save failed',
        );
        throw error;
      }

      return uploadedName;
    });

    this.logger.info({ userId }, 'Avatar uploaded');
    return fileName;
  }

  async deleteAvatar(id: number, userId: number): Promise<void> {
    const avatar = await this.avatarsRepository.findActiveById(id);
    if (!avatar) {
      throw new NotFoundException('Avatar not found');
    }

    if (avatar.userId !== userId) {
      this.logger.warn(
        { userId, avatarId: id },
        'User tried to delete another user avatar',
      );
      throw new ForbiddenException('You can only delete your own avatar');
    }

    await this.avatarsRepository.softDelete(id);
    this.logger.info({ userId, avatarId: id }, 'Avatar deleted');
  }

  private async removeUploadedFile(
    fileName: string,
    userId: number,
  ): Promise<void> {
    try {
      await this.s3Service.remove(fileName);
    } catch (error) {
      this.logger.error(
        {
          userId,
          name: error instanceof Error ? error.name : 'UnknownError',
        },
        'Avatar cleanup failed',
      );
    }
  }
}
