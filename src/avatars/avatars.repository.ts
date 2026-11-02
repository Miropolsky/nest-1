import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AvatarEntity } from './avatar.entity.js';

@Injectable()
export class AvatarsRepository {
  constructor(
    @InjectRepository(AvatarEntity)
    private readonly repo: Repository<AvatarEntity>,
  ) {}

  countActive(userId: number) {
    return this.repo.count({ where: { userId } });
  }

  save(avatar: Pick<AvatarEntity, 'userId' | 'fileName'>) {
    return this.repo.save(this.repo.create(avatar));
  }

  findActiveById(id: number) {
    return this.repo.findOneBy({ id });
  }

  softDelete(id: number) {
    return this.repo.softDelete(id);
  }
}
