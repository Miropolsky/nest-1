import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { AvatarEntity } from './avatar.entity.js';

const AVATAR_LOCK_NAMESPACE = 4101;

@Injectable()
export class AvatarsRepository {
  constructor(
    @InjectRepository(AvatarEntity)
    private readonly repo: Repository<AvatarEntity>,
  ) {}

  lockUser(userId: number, manager: EntityManager) {
    return manager.query('SELECT pg_advisory_xact_lock($1, $2)', [
      AVATAR_LOCK_NAMESPACE,
      userId,
    ]);
  }

  countActive(userId: number, manager: EntityManager = this.repo.manager) {
    return manager.count(AvatarEntity, { where: { userId } });
  }

  save(
    avatar: Pick<AvatarEntity, 'userId' | 'fileName'>,
    manager: EntityManager = this.repo.manager,
  ) {
    return manager.save(AvatarEntity, manager.create(AvatarEntity, avatar));
  }

  findActiveById(id: number) {
    return this.repo.findOneBy({ id });
  }

  softDelete(id: number) {
    return this.repo.softDelete(id);
  }
}
