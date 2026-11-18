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
  const cacheStore = new Map<string, unknown>();
  const cache = {
    get: vi.fn(async (key: string) => cacheStore.get(key)),
    set: vi.fn(async (key: string, value: unknown) => {
      cacheStore.set(key, value);
    }),
    del: vi.fn(async (key: string) => {
      cacheStore.delete(key);
      return true;
    }),
    mdel: vi.fn(async (keys: string[]) => {
      for (const key of keys) {
        cacheStore.delete(key);
      }
      return true;
    }),
    stores: [
      {
        iterator: async function* () {
          yield [
            'users:list:{"page":1,"limit":10,"login":"","email":"","age":"","sortBy":"login","sortOrder":"ASC"}',
            null,
          ];
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
    cacheStore.clear();
    cache.get.mockImplementation(async (key: string) => cacheStore.get(key));
    cache.set.mockImplementation(async (key: string, value: unknown) => {
      cacheStore.set(key, value);
    });
    cache.del.mockImplementation(async (key: string) => {
      cacheStore.delete(key);
      return true;
    });
    cache.mdel.mockImplementation(async (keys: string[]) => {
      for (const key of keys) {
        cacheStore.delete(key);
      }
      return true;
    });
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

    expect(cache.mdel).toHaveBeenCalledWith([
      'users:list:{"page":1,"limit":10,"login":"","email":"","age":"","sortBy":"login","sortOrder":"ASC"}',
    ]);
    expect(cache.del).not.toHaveBeenCalled();
  });

  it('после изменения профиля удаляет профиль и список', async () => {
    repository.findOne.mockResolvedValue(user);
    repository.update.mockResolvedValue(undefined);

    await service.update(1, { description: 'updated' });

    expect(cache.del).toHaveBeenCalledWith('users:one:1');
    expect(cache.set).toHaveBeenCalledWith('users:one:1:version', 1);
    expect(cache.set).toHaveBeenCalledWith('users:list:version', 1);
    expect(cache.mdel).toHaveBeenCalledWith([
      'users:list:{"page":1,"limit":10,"login":"","email":"","age":"","sortBy":"login","sortOrder":"ASC"}',
    ]);
  });

  it('не пишет в кэш профиль, если во время чтения была инвалидация', async () => {
    let resolveLoad: ((value: typeof user) => void) | undefined;
    repository.findOne.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveLoad = resolve;
        }),
    );

    const pending = service.findOne(1);
    await vi.waitFor(() => {
      expect(repository.findOne).toHaveBeenCalledTimes(1);
    });

    repository.findOne.mockResolvedValue({
      ...user,
      description: 'updated',
    });
    repository.update.mockResolvedValue(undefined);
    await service.update(1, { description: 'updated' });
    cacheStore.delete('users:one:1');
    cache.set.mockClear();

    resolveLoad?.(user);
    await pending;

    expect(cache.set.mock.calls.some(([key]) => key === 'users:one:1')).toBe(
      false,
    );
    expect(cacheStore.has('users:one:1')).toBe(false);
  });

  it('фильтры с ":" не дают одинаковый ключ списка', async () => {
    repository.findAll.mockResolvedValue([]);

    await service.findAll({ login: 'a:b', email: 'c' });
    await service.findAll({ login: 'a', email: 'b:c' });

    const profileOrListSets = cache.set.mock.calls.filter(
      ([key]) =>
        typeof key === 'string' &&
        (key.startsWith('users:list:{') || key.startsWith('users:one:')),
    );
    expect(profileOrListSets).toHaveLength(2);
    const [firstKey] = profileOrListSets[0] as [string];
    const [secondKey] = profileOrListSets[1] as [string];
    expect(firstKey).not.toBe(secondKey);
    expect(firstKey).toContain('"login":"a:b"');
    expect(secondKey).toContain('"email":"b:c"');
  });
});
