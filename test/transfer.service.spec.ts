import { BadRequestException } from '@nestjs/common';
import type { Cache } from 'cache-manager';
import type { PinoLogger } from 'nestjs-pino';
import type { DataSource, EntityManager } from 'typeorm';
import { UsersService } from '../src/users/users.service.js';
import type { UsersRepository } from '../src/users/users.repository.js';

type Ledger = Map<number, number>;

function logger(): PinoLogger {
  return {
    setContext: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  } as unknown as PinoLogger;
}

function queryBuilder(ledger: Ledger, failCredit = false) {
  let userId = 0;
  let amount = 0;
  let mode: 'debit' | 'credit' = 'debit';
  const builder = {
    update: () => builder,
    set: (values: { balance: () => string }) => {
      const sql = values.balance();
      mode = sql.includes(' - ') ? 'debit' : 'credit';
      return builder;
    },
    where: (_sql: string, params: { id: number }) => {
      userId = params.id;
      return builder;
    },
    andWhere: () => builder,
    setParameter: (_name: string, value: string) => {
      amount = Number(value);
      return builder;
    },
    execute: () => {
      if (mode === 'credit' && failCredit) {
        return { affected: 0 };
      }

      const current = ledger.get(userId) ?? 0;
      if (mode === 'debit') {
        if (current < amount) {
          return { affected: 0 };
        }
        ledger.set(userId, current - amount);
      } else {
        ledger.set(userId, current + amount);
      }
      return { affected: 1 };
    },
  };

  return builder;
}

function serviceWith(ledger: Ledger, failCredit = false) {
  const repository = {
    findOne: vi.fn().mockResolvedValue({
      id: 1,
      login: 'ivan',
      email: 'ivan@example.com',
      description: 'about',
      age: 20,
      balance: '0.00',
    }),
  };
  const cache = {
    get: vi.fn().mockResolvedValue(undefined),
    set: vi.fn().mockResolvedValue(undefined),
    del: vi.fn().mockResolvedValue(true),
    mdel: vi.fn().mockResolvedValue(true),
    stores: [{ iterator: async function* () {} }],
  };
  const dataSource = {
    transaction: async (work: (manager: EntityManager) => Promise<void>) => {
      const snapshot = failCredit ? new Map(ledger) : null;
      const manager = {
        createQueryBuilder: () => queryBuilder(ledger, failCredit),
      } as unknown as EntityManager;

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

describe('UsersService transfer', () => {
  it('отклоняет нулевую, отрицательную и слишком дробную сумму', async () => {
    const service = serviceWith(new Map());

    await expect(
      service.transfer({ amount: '0.00', recipientId: '2' }, 1),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.transfer({ amount: '-1.00', recipientId: '2' }, 1),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.transfer({ amount: '1.234', recipientId: '2' }, 1),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('десять параллельных переводов сохраняют сумму и не уводят баланс ниже нуля', async () => {
    const ledger = new Map<number, number>([
      [1, 50],
      [2, 0],
    ]);
    const service = serviceWith(ledger);
    const results = await Promise.allSettled(
      Array.from({ length: 10 }, () =>
        service.transfer({ amount: '10.00', recipientId: '2' }, 1),
      ),
    );

    const succeeded = results.filter((result) => result.status === 'fulfilled');
    expect(succeeded).toHaveLength(5);
    expect(ledger.get(1)).toBe(0);
    expect(ledger.get(2)).toBe(50);
    expect([...ledger.values()].every((balance) => balance >= 0)).toBe(true);
  });

  it('откатывает списание, если зачисление никого не обновило', async () => {
    const ledger = new Map<number, number>([
      [1, 20],
      [2, 0],
    ]);
    const service = serviceWith(ledger, true);

    await expect(
      service.transfer({ amount: '10.50', recipientId: '2' }, 1),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(ledger.get(1)).toBe(20);
    expect(ledger.get(2)).toBe(0);
  });
});
