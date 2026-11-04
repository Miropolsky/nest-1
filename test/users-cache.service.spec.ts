import type { Cache } from 'cache-manager';
import type { PinoLogger } from 'nestjs-pino';
import type { DataSource } from 'typeorm';
import { UsersService } from '../src/users/users.service.js';
import type { UsersRepository } from '../src/users/users.repository.js';

const user = {
  id: 1,
  login: 'ivan',
  email: 'ivan@example.com',
  description: 'about',
  age: 20,
  balance: '10.00',
  password: 'hash',
};

function logger(): PinoLogger {
  return {
    setContext: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  } as unknown as PinoLogger;
}

describe('UsersService cache', () => {
  const repository = {
    findOne: vi.fn(),
    findAll: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  };
  const cache = {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
    mdel: vi.fn(),
    stores: [
      {
        iterator: async function* () {
          yield ['users:list:1:10:::login:ASC', null];
          yield ['users:one:1', null];
        },
      },
    ],
  };

  const service = new UsersService(
    repository as unknown as UsersRepository,
    logger(),
    {} as DataSource,
    cache as unknown as Cache,
  );

  beforeEach(() => {
    vi.clearAllMocks();
    cache.get.mockResolvedValue(undefined);
    cache.set.mockResolvedValue(undefined);
    cache.del.mockResolvedValue(true);
    cache.mdel.mockResolvedValue(true);
  });

  it('один промах кэша выполняет один запрос в базу', async () => {
    repository.findOne.mockResolvedValue(user);

    const [first, second] = await Promise.all([
      service.findOne(1),
      service.findOne(1),
    ]);

    expect(first).toEqual(second);
    expect(repository.findOne).toHaveBeenCalledTimes(1);
    expect(cache.set).toHaveBeenCalledTimes(1);
  });

  it('после создания пользователя удаляет закэшированный список', async () => {
    repository.create.mockResolvedValue(user);

    await service.create({
      login: 'ivan',
      email: 'ivan@example.com',
      password: 'password1',
      description: 'about',
      age: 20,
    });

    expect(cache.mdel).toHaveBeenCalledWith(['users:list:1:10:::login:ASC']);
    expect(cache.del).not.toHaveBeenCalled();
  });

  it('после изменения профиля удаляет профиль и список', async () => {
    repository.findOne.mockResolvedValue(user);
    repository.update.mockResolvedValue(undefined);

    await service.update(1, { description: 'updated' });

    expect(cache.del).toHaveBeenCalledWith('users:one:1');
    expect(cache.mdel).toHaveBeenCalledWith(['users:list:1:10:::login:ASC']);
  });
});
