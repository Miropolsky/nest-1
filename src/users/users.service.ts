import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { compare, hash } from 'bcrypt';
import { CreateUserDto } from './dto/create-user.dto.js';
import { FindUsersQueryDto } from './dto/find-users.query.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { UserDto } from './dto/user.dto.js';
import { UserEntity } from './user.entity.js';
import { UsersRepository } from './users.repository.js';

export type AuthUser = {
  id: number;
  login: string;
};

@Injectable()
export class UsersService {
  constructor(private readonly usersRepository: UsersRepository) {}

  async create(dto: CreateUserDto): Promise<UserDto> {
    const user = await this.usersRepository.create({
      ...dto,
      password: await hash(dto.password, 10),
    });
    return this.toUserDto(user);
  }

  async update(id: number, dto: UpdateUserDto): Promise<UserDto> {
    await this.findEntityById(id);
    await this.assertUniqueCredentials(id, dto);

    const data = { ...dto };
    if (data.password) {
      data.password = await hash(data.password, 10);
    }

    await this.usersRepository.update(id, data);
    return this.getProfile(id);
  }

  async findAll(query: FindUsersQueryDto): Promise<UserDto[]> {
    const users = await this.usersRepository.findAll(query);
    return users.map((user) => this.toUserDto(user));
  }

  async findOne(id: number): Promise<UserDto> {
    const user = await this.findEntityById(id);
    return this.toUserDto(user);
  }

  async remove(id: number): Promise<void> {
    await this.findEntityById(id);
    await this.usersRepository.remove(id);
  }

  async getProfile(id: number): Promise<UserDto> {
    const user = await this.findEntityById(id);
    return this.toUserDto(user);
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
    };
  }
}
