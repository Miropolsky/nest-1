import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateUserDto } from './dto/create-user.dto.js';
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

  findAll() {
    return this.repo.find();
  }

  findOne(id: number) {
    return this.repo.findOneBy({ id });
  }

  remove(id: number) {
    return this.repo.delete(id);
  }

  findOneByLogin(login: string) {
    return this.repo.findOneBy({ login });
  }

  findOneByEmail(email: string) {
    return this.repo.findOneBy({ email });
  }
}
