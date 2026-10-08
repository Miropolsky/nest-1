import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Like, Repository } from 'typeorm';
import { CreateUserDto } from './dto/create-user.dto.js';
import { FindUsersQueryDto } from './dto/find-users.query.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { UserEntity } from './user.entity.js';

@Injectable()
export class UsersRepository {
  constructor(
    @InjectRepository(UserEntity)
    private readonly repo: Repository<UserEntity>,
  ) {}

  create(user: CreateUserDto) {
    return this.repo.save(user);
  }

  update(id: number, user: UpdateUserDto) {
    return this.repo.update(id, user);
  }

  findAll(query: FindUsersQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const sortBy = query.sortBy ?? 'login';
    const sortOrder = query.sortOrder ?? 'ASC';
    const where: FindOptionsWhere<UserEntity> = {};

    if (query.login) {
      where.login = Like(`%${query.login}%`);
    }
    if (query.email) {
      where.email = Like(`%${query.email}%`);
    }
    if (query.age !== undefined) {
      where.age = query.age;
    }

    return this.repo.find({
      skip: (page - 1) * limit,
      take: limit,
      where,
      order: { [sortBy]: sortOrder },
    });
  }

  findOne(id: number) {
    return this.repo.findOneBy({ id });
  }

  remove(id: number) {
    return this.repo.softDelete(id);
  }

  findOneByLogin(login: string) {
    return this.repo.findOneBy({ login });
  }

  findOneByEmail(email: string) {
    return this.repo.findOneBy({ email });
  }

  updateRefreshTokenHash(id: number, refreshTokenHash: string | null) {
    return this.repo.update(id, { refreshTokenHash });
  }
}
