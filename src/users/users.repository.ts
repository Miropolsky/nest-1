import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Like, Repository } from 'typeorm';
import { ActiveUserDto } from './dto/active-user.dto.js';
import { CreateUserDto } from './dto/create-user.dto.js';
import { FindActiveUsersQueryDto } from './dto/find-active-users.query.dto.js';
import { FindUsersQueryDto } from './dto/find-users.query.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { UserEntity } from './user.entity.js';

type ActiveUserRaw = {
  id: number | string;
  login: string;
  email: string;
  description: string;
  age: number | string;
  avatarId: number | string;
  fileName: string;
  uploadedAt: Date | string;
};

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

  async findActiveUsers(
    query: FindActiveUsersQueryDto,
  ): Promise<ActiveUserDto[]> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const users = this.repo
      .createQueryBuilder('user')
      .innerJoin(
        `(
          SELECT "user_id", COUNT(*)::int AS "activeCount"
          FROM "avatar_entity"
          WHERE "deletedAt" IS NULL
          GROUP BY "user_id"
          HAVING COUNT(*) > 2
        )`,
        'active',
        'active."user_id" = "user"."id"',
      )
      .innerJoin(
        `(
          SELECT DISTINCT ON ("user_id")
            "user_id",
            id,
            "fileName",
            "uploadedAt"
          FROM "avatar_entity"
          WHERE "deletedAt" IS NULL
          ORDER BY "user_id", "uploadedAt" DESC, id DESC
        )`,
        'latest',
        'latest."user_id" = "user"."id"',
      )
      .where(`BTRIM("user"."description") != ''`);

    if (query.minAge !== undefined) {
      users.andWhere('"user"."age" >= :minAge', { minAge: query.minAge });
    }
    if (query.maxAge !== undefined) {
      users.andWhere('"user"."age" <= :maxAge', { maxAge: query.maxAge });
    }

    const rows = await users
      .select('"user"."id"', 'id')
      .addSelect('"user"."login"', 'login')
      .addSelect('"user"."email"', 'email')
      .addSelect('"user"."description"', 'description')
      .addSelect('"user"."age"', 'age')
      .addSelect('latest.id', 'avatarId')
      .addSelect('latest."fileName"', 'fileName')
      .addSelect('latest."uploadedAt"', 'uploadedAt')
      .orderBy('active."activeCount"', 'DESC')
      .addOrderBy('"user"."id"', 'ASC')
      .offset((page - 1) * limit)
      .limit(limit)
      .getRawMany<ActiveUserRaw>();

    return rows.map((row) => ({
      id: Number(row.id),
      login: row.login,
      email: row.email,
      description: row.description,
      age: Number(row.age),
      latestAvatar: {
        id: Number(row.avatarId),
        fileName: row.fileName,
        uploadedAt: new Date(row.uploadedAt),
      },
    }));
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
