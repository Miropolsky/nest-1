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
import { DataSource } from 'typeorm';
import { ActiveUserDto } from './dto/active-user.dto.js';
import { CreateUserDto } from './dto/create-user.dto.js';
import { FindActiveUsersQueryDto } from './dto/find-active-users.query.dto.js';
import { FindUsersQueryDto } from './dto/find-users.query.dto.js';
import { TransferDto } from './dto/transfer.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { UserDto } from './dto/user.dto.js';
import { UserUniqueViolationError } from './errors/user-unique-violation.error.js';
import { parseAmount } from './helpers/parse-amount.js';
import { UserEntity } from './user.entity.js';
import { UsersRepository } from './users.repository.js';

export type AuthUser = {
  id: number;
  login: string;
};

@Injectable()
export class UsersService {
  private readonly pendingReads = new Map<string, Promise<unknown>>();

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
      const created = this.toUserDto(user);
      await this.invalidateListCache();
      return created;
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
    await this.invalidateProfiles(id);
    return this.getProfile(id);
  }

  async transfer(transferDto: TransferDto, id_user: number): Promise<UserDto> {
    const amount = parseAmount(transferDto.amount);
    const recipientId = transferDto.recipientId;

    if (id_user === recipientId) {
      throw new BadRequestException('Нельзя перевести самому себе');
    }

    await this.dataSource.transaction(async (manager) => {
      const [firstId, secondId] =
        id_user < recipientId ? [id_user, recipientId] : [recipientId, id_user];

      const first = await this.usersRepository.lockActiveUser(firstId, manager);
      const second = await this.usersRepository.lockActiveUser(
        secondId,
        manager,
      );
      if (!first || !second) {
        throw new NotFoundException('User not found');
      }

      const debit = await this.usersRepository.debitBalance(
        id_user,
        amount,
        manager,
      );
      if (debit.affected === 0) {
        throw new BadRequestException('Недостаточно средств');
      }

      const credit = await this.usersRepository.creditBalance(
        recipientId,
        amount,
        manager,
      );
      if (credit.affected === 0) {
        throw new NotFoundException('User not found');
      }
    });

    this.logger.info(
      {
        senderId: id_user,
        recipientId,
        amount,
      },
      'Transfer completed',
    );

    try {
      await this.invalidateProfiles(id_user, recipientId);
    } catch (error) {
      this.logger.error(
        {
          senderId: id_user,
          recipientId,
          name: error instanceof Error ? error.name : 'UnknownError',
        },
        'Cache invalidation failed after transfer',
      );
    }

    return this.loadProfile(id_user);
  }

  async findAll(query: FindUsersQueryDto): Promise<UserDto[]> {
    return this.readThrough(
      this.usersListCacheKey(query),
      async () => {
        const users = await this.usersRepository.findAll(query);
        return users.map((user) => this.toUserDto(user));
      },
      this.usersListCacheVersionKey(),
    );
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
    return this.readThrough(
      this.userCacheKey(id),
      () => this.loadProfile(id),
      this.userCacheVersionKey(id),
    );
  }

  async remove(id: number): Promise<void> {
    await this.findEntityById(id);
    await this.usersRepository.updateRefreshTokenHash(id, null);
    await this.usersRepository.remove(id);
    await this.invalidateProfiles(id);
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

  private readThrough<T>(
    key: string,
    loader: () => Promise<T>,
    versionKey?: string,
  ): Promise<T> {
    const pending = this.pendingReads.get(key);
    if (pending) {
      return pending as Promise<T>;
    }

    const promise = this.loadThroughCache(key, loader, versionKey).finally(
      () => {
        if (this.pendingReads.get(key) === promise) {
          this.pendingReads.delete(key);
        }
      },
    );
    this.pendingReads.set(key, promise);
    return promise;
  }

  private async loadThroughCache<T>(
    key: string,
    loader: () => Promise<T>,
    versionKey?: string,
  ): Promise<T> {
    const version =
      versionKey === undefined
        ? undefined
        : await this.getCacheVersion(versionKey);

    const cached = await this.cache.get<T>(key);
    if (cached !== undefined && cached !== null) {
      return cached;
    }

    const value = await loader();

    if (
      versionKey !== undefined &&
      (await this.getCacheVersion(versionKey)) !== version
    ) {
      return value;
    }

    await this.cache.set(key, value);
    return value;
  }

  private async invalidateProfiles(...ids: number[]): Promise<void> {
    await Promise.all(ids.map((id) => this.invalidateProfile(id)));
    await this.invalidateListCache();
  }

  private async invalidateProfile(id: number): Promise<void> {
    const key = this.userCacheKey(id);
    this.pendingReads.delete(key);
    await Promise.all([
      this.cache.del(key),
      this.bumpCacheVersion(this.userCacheVersionKey(id)),
    ]);
  }

  private async invalidateListCache(): Promise<void> {
    for (const key of this.pendingReads.keys()) {
      if (key.startsWith('users:list:')) {
        this.pendingReads.delete(key);
      }
    }

    await this.bumpCacheVersion(this.usersListCacheVersionKey());

    const keys = new Set<string>();

    for (const store of this.cache.stores as Array<{
      iterator?: () => AsyncIterable<unknown>;
    }>) {
      if (!store.iterator) {
        continue;
      }

      for await (const entry of store.iterator()) {
        const rawKey = Array.isArray(entry) ? entry[0] : undefined;
        if (typeof rawKey !== 'string') {
          continue;
        }

        const separator = rawKey.indexOf('::');
        const withoutPrefix =
          separator === -1 ? rawKey : rawKey.slice(separator + 2);
        const key =
          withoutPrefix.startsWith('users:list:') ||
          withoutPrefix.startsWith('users:one:')
            ? withoutPrefix
            : rawKey;
        if (key.startsWith('users:list:')) {
          keys.add(key);
        }
      }
    }

    if (keys.size > 0) {
      await this.cache.mdel([...keys]);
    }
  }

  private async getCacheVersion(versionKey: string): Promise<number> {
    const raw = await this.cache.get<unknown>(versionKey);
    if (typeof raw === 'number' && Number.isFinite(raw)) {
      return raw;
    }
    if (typeof raw === 'string' && raw.trim() !== '') {
      const parsed = Number(raw);
      return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
  }

  private async bumpCacheVersion(versionKey: string): Promise<void> {
    const next = (await this.getCacheVersion(versionKey)) + 1;
    await this.cache.set(versionKey, next);
  }

  private userCacheKey(id: number): string {
    return `users:one:${id}`;
  }

  private userCacheVersionKey(id: number): string {
    return `users:one:${id}:version`;
  }

  private usersListCacheVersionKey(): string {
    return 'users:list:version';
  }

  private usersListCacheKey(query: FindUsersQueryDto): string {
    return `users:list:${JSON.stringify({
      page: query.page ?? 1,
      limit: query.limit ?? 10,
      login: query.login ?? '',
      email: query.email ?? '',
      age: query.age ?? '',
      sortBy: query.sortBy ?? 'login',
      sortOrder: query.sortOrder ?? 'ASC',
    })}`;
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
    if (error instanceof UserUniqueViolationError) {
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
    if (!(error instanceof UserUniqueViolationError)) {
      throw error;
    }

    if (error.field === 'login') {
      throw new ConflictException('Login already taken');
    }
    if (error.field === 'email') {
      throw new ConflictException('Email already taken');
    }

    throw new ConflictException('User already exists');
  }
}
