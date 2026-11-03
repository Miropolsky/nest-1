import { CACHE_MANAGER } from '@nestjs/cache-manager';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { compare, hash } from 'bcrypt';
import type { Cache } from 'cache-manager';
import { PinoLogger } from 'nestjs-pino';
import { DataSource, QueryFailedError } from 'typeorm';
import { ActiveUserDto } from './dto/active-user.dto.js';
import { CreateUserDto } from './dto/create-user.dto.js';
import { FindActiveUsersQueryDto } from './dto/find-active-users.query.dto.js';
import { FindUsersQueryDto } from './dto/find-users.query.dto.js';
import { TransferDto } from './dto/transfer.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { UserDto } from './dto/user.dto.js';
import { UserEntity } from './user.entity.js';
import { UsersRepository } from './users.repository.js';

export type AuthUser = {
  id: number;
  login: string;
};

type PgDriverError = {
  code?: string;
  detail?: string;
  constraint?: string;
};

@Injectable()
export class UsersService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly logger: PinoLogger,
    private readonly dataSource: DataSource,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {
    this.logger.setContext(UsersService.name);
  }

  async create(dto: CreateUserDto): Promise<UserDto> {
    try {
      const user = await this.usersRepository.create({
        ...dto,
        password: await hash(dto.password, 10),
      });

      return this.toUserDto(user);
    } catch (error) {
      this.logWriteFailure(error, 'User registration failed');
      this.rethrowUniqueViolation(error);
    }
  }

  async update(id: number, dto: UpdateUserDto): Promise<UserDto> {
    await this.findEntityById(id);
    await this.assertUniqueCredentials(id, dto);

    const data = { ...dto };
    if (data.password) {
      data.password = await hash(data.password, 10);
    }

    try {
      await this.usersRepository.update(id, data);
    } catch (error) {
      this.logWriteFailure(error, 'User update failed', id);
      this.rethrowUniqueViolation(error);
    }

    this.logger.info({ userId: id }, 'User updated');
    await this.cache.del(this.userCacheKey(id));
    return this.getProfile(id);
  }

  async transfer(transferDto: TransferDto, id_user: number): Promise<UserDto> {
    const { amount, recipientId } = transferDto;

    if (Number(amount) <= 0 || !Number.isFinite(Number(amount))) {
      throw new BadRequestException('Некорректная сумма');
    }

    if (id_user === Number(recipientId)) {
      throw new BadRequestException('Нельзя перевести самому себе');
    }

    await this.dataSource.transaction(async (manager) => {
      const debit = await manager
        .createQueryBuilder()
        .update(UserEntity)
        .set({
          balance: () => '"balance" - :amount',
        })
        .where('id = :id', { id: id_user })
        .andWhere('balance >= :amount', { amount })
        .setParameter('amount', amount)
        .execute();

      if (debit.affected === 0) {
        throw new BadRequestException(
          'Недостаточно средств или пользователь не найден',
        );
      }

      const credit = await manager
        .createQueryBuilder()
        .update(UserEntity)
        .set({
          balance: () => '"balance" + :amount',
        })
        .where('id = :id', { id: Number(recipientId) })
        .setParameter('amount', amount)
        .execute();

      if (credit.affected === 0) {
        throw new BadRequestException('Не удалось перевести деньги');
      }
    });

    await Promise.all([
      this.cache.del(this.userCacheKey(id_user)),
      this.cache.del(this.userCacheKey(Number(recipientId))),
    ]);

    return this.cache.wrap(this.userCacheKey(id_user), async () =>
      this.loadProfile(id_user),
    );
  }

  async findAll(query: FindUsersQueryDto): Promise<UserDto[]> {
    return this.cache.wrap(this.usersListCacheKey(query), async () => {
      const users = await this.usersRepository.findAll(query);
      return users.map((user) => this.toUserDto(user));
    });
  }

  async findActiveUsers(
    query: FindActiveUsersQueryDto,
  ): Promise<ActiveUserDto[]> {
    if (
      query.minAge !== undefined &&
      query.maxAge !== undefined &&
      query.minAge > query.maxAge
    ) {
      throw new BadRequestException(
        'minAge must be less than or equal to maxAge',
      );
    }

    return this.usersRepository.findActiveUsers(query);
  }

  async findOne(id: number): Promise<UserDto> {
    return this.cache.wrap(this.userCacheKey(id), () => this.loadProfile(id));
  }

  async remove(id: number): Promise<void> {
    await this.findEntityById(id);
    await this.usersRepository.updateRefreshTokenHash(id, null);
    await this.usersRepository.remove(id);
    await this.cache.del(this.userCacheKey(id));
    this.logger.info({ userId: id }, 'User deleted');
  }

  async getProfile(id: number): Promise<UserDto> {
    return this.findOne(id);
  }

  async existsByLogin(login: string): Promise<boolean> {
    const user = await this.usersRepository.findOneByLogin(login);
    return !!user;
  }

  async existsByEmail(email: string): Promise<boolean> {
    const user = await this.usersRepository.findOneByEmail(email);
    return !!user;
  }

  async validateCredentials(
    login: string,
    password: string,
  ): Promise<AuthUser | null> {
    const user = await this.usersRepository.findOneByLogin(login);

    if (!user) {
      return null;
    }

    const isValid = await compare(password, user.password);
    if (!isValid) {
      return null;
    }

    return { id: user.id, login: user.login };
  }

  async getRefreshTokenHash(userId: number): Promise<string | null> {
    const user = await this.findEntityById(userId);
    return user.refreshTokenHash;
  }

  async setRefreshTokenHash(
    userId: number,
    refreshTokenHash: string | null,
  ): Promise<void> {
    await this.usersRepository.updateRefreshTokenHash(userId, refreshTokenHash);
  }

  private async assertUniqueCredentials(
    id: number,
    dto: UpdateUserDto,
  ): Promise<void> {
    if (dto.login) {
      const existing = await this.usersRepository.findOneByLogin(dto.login);
      if (existing && existing.id !== id) {
        throw new ConflictException('Login already taken');
      }
    }

    if (dto.email) {
      const existing = await this.usersRepository.findOneByEmail(dto.email);
      if (existing && existing.id !== id) {
        throw new ConflictException('Email already taken');
      }
    }
  }

  private async loadProfile(id: number): Promise<UserDto> {
    const user = await this.findEntityById(id);
    return this.toUserDto(user);
  }

  private userCacheKey(id: number): string {
    return `users:one:${id}`;
  }

  private usersListCacheKey(query: FindUsersQueryDto): string {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const sortBy = query.sortBy ?? 'login';
    const sortOrder = query.sortOrder ?? 'ASC';

    return [
      'users:list',
      page,
      limit,
      query.login ?? '',
      query.email ?? '',
      query.age ?? '',
      sortBy,
      sortOrder,
    ].join(':');
  }

  private async findEntityById(id: number): Promise<UserEntity> {
    const user = await this.usersRepository.findOne(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  private toUserDto(user: UserEntity): UserDto {
    return {
      id: user.id,
      login: user.login,
      email: user.email,
      description: user.description,
      age: user.age,
      balance: user.balance,
    };
  }

  private logWriteFailure(
    error: unknown,
    message: string,
    userId?: number,
  ): void {
    if (this.isPgUniqueViolation(error)) {
      this.logger.warn(
        userId === undefined ? {} : { userId },
        'User already exists',
      );
      return;
    }

    this.logger.error(
      {
        userId,
        name: error instanceof Error ? error.name : 'UnknownError',
      },
      message,
    );
  }

  private rethrowUniqueViolation(error: unknown): never {
    if (!this.isPgUniqueViolation(error)) {
      throw error;
    }

    const driverError = this.getPgDriverError(error);
    const hint =
      `${driverError.constraint ?? ''} ${driverError.detail ?? ''}`.toLowerCase();

    if (hint.includes('login')) {
      throw new ConflictException('Login already taken');
    }
    if (hint.includes('email')) {
      throw new ConflictException('Email already taken');
    }

    throw new ConflictException('User already exists');
  }

  private isPgUniqueViolation(error: unknown): boolean {
    if (!(error instanceof QueryFailedError)) {
      return false;
    }
    return this.getPgDriverError(error).code === '23505';
  }

  private getPgDriverError(error: unknown): PgDriverError {
    if (!(error instanceof QueryFailedError)) {
      return {};
    }

    const withDriver = error as QueryFailedError & {
      driverError?: PgDriverError;
      code?: string;
      detail?: string;
      constraint?: string;
    };

    return {
      code: withDriver.driverError?.code ?? withDriver.code,
      detail: withDriver.driverError?.detail ?? withDriver.detail,
      constraint: withDriver.driverError?.constraint ?? withDriver.constraint,
    };
  }
}
