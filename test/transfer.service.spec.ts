import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { Cache } from 'cache-manager';
import type { PinoLogger } from 'nestjs-pino';
import type { DataSource, EntityManager } from 'typeorm';
import type { UsersRepository } from '../src/users/users.repository.js';
import { UsersService } from '../src/users/users.service.js';

type Ledger = Map<number, number>;
type Users = Map<number, { active: boolean }>;

function logger(): PinoLogger {
  return {
    setContext: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  } as unknown as PinoLogger;
}

function serviceWith(
  ledger: Ledger,
  users: Users = new Map(
    [...ledger.keys()].map((id) => [id, { active: true }]),
  ),
  failCredit = false,
  failCache = false,
) {
  const repository = {
    findOne: vi.fn().mockImplementation(async (id: number) => ({
      id,
      login: `user_${id}`,
      email: `user_${id}@example.com`,
      description: 'about',
      age: 20,
      balance: DecimalLike(ledger.get(id) ?? 0),
    })),
    lockActiveUser: vi.fn().mockImplementation(async (id: number) => {
      const user = users.get(id);
      return user?.active ? { id } : null;
    }),
    debitBalance: vi
      .fn()
      .mockImplementation(async (id: number, amount: string) => {
        const user = users.get(id);
        if (!user?.active) {
          return { affected: 0 };
        }

        const value = Number(amount);
        const current = ledger.get(id) ?? 0;
        if (current < value) {
          return { affected: 0 };
        }

        ledger.set(id, current - value);
        return { affected: 1 };
      }),
    creditBalance: vi
      .fn()
      .mockImplementation(async (id: number, amount: string) => {
        if (failCredit) {
          return { affected: 0 };
        }

        const user = users.get(id);
        if (!user?.active) {
          return { affected: 0 };
        }

        ledger.set(id, (ledger.get(id) ?? 0) + Number(amount));
        return { affected: 1 };
      }),
  };
  const cache = {
    get: vi.fn().mockResolvedValue(undefined),
    set: vi.fn().mockResolvedValue(undefined),
    del: vi.fn().mockImplementation(async () => {
      if (failCache) {
        throw new Error('Redis unavailable');
      }
      return true;
    }),
    mdel: vi.fn().mockResolvedValue(true),
    stores: [{ iterator: async function* () {} }],
  };
  const dataSource = {
    transaction: async (work: (manager: EntityManager) => Promise<void>) => {
      const snapshot = failCredit ? new Map(ledger) : null;
      const manager = {} as EntityManager;

      try {
        await work(manager);
      } catch (error) {
        if (snapshot) {
          ledger.clear();
          for (const [id, balance] of snapshot) {
            ledger.set(id, balance);
          }
        }
        throw error;
      }
    },
  };

  return new UsersService(
    repository as unknown as UsersRepository,
    logger(),
    dataSource as unknown as DataSource,
    cache as unknown as Cache,
  );
}

function DecimalLike(value: number): string {
  return value.toFixed(2);
}

describe('UsersService transfer', () => {
  it('отклоняет нулевую, отрицательную и слишком дробную сумму', async () => {
    const service = serviceWith(
      new Map([
        [1, 10],
        [2, 0],
      ]),
    );

    await expect(
      service.transfer({ amount: '0.00', recipientId: 2 }, 1),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.transfer({ amount: '-1.00', recipientId: 2 }, 1),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.transfer({ amount: '1.234', recipientId: 2 }, 1),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('откатывает списание, если зачисление никого не обновило', async () => {
    const ledger = new Map<number, number>([
      [1, 20],
      [2, 0],
    ]);
    const service = serviceWith(ledger, undefined, true);

    await expect(
      service.transfer({ amount: '10.50', recipientId: 2 }, 1),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(ledger.get(1)).toBe(20);
    expect(ledger.get(2)).toBe(0);
  });

  it('возвращает 404, если получатель soft-deleted', async () => {
    const ledger = new Map<number, number>([
      [1, 20],
      [2, 0],
    ]);
    const users = new Map([
      [1, { active: true }],
      [2, { active: false }],
    ]);
    const service = serviceWith(ledger, users);

    await expect(
      service.transfer({ amount: '10.00', recipientId: 2 }, 1),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(ledger.get(1)).toBe(20);
    expect(ledger.get(2)).toBe(0);
  });

  it('возвращает 404, если получатель не существует', async () => {
    const ledger = new Map<number, number>([[1, 20]]);
    const users = new Map([[1, { active: true }]]);
    const service = serviceWith(ledger, users);

    await expect(
      service.transfer({ amount: '10.00', recipientId: 999 }, 1),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(ledger.get(1)).toBe(20);
  });

  it('возвращает результат перевода, даже если инвалидация кэша упала', async () => {
    const ledger = new Map<number, number>([
      [1, 20],
      [2, 0],
    ]);
    const service = serviceWith(ledger, undefined, false, true);

    const result = await service.transfer(
      { amount: '10.00', recipientId: 2 },
      1,
    );

    expect(result.balance).toBe('10.00');
    expect(ledger.get(1)).toBe(10);
    expect(ledger.get(2)).toBe(10);
  });
});
