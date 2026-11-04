import type { Queue } from 'bullmq';
import type { Job } from 'bullmq';
import type { PinoLogger } from 'nestjs-pino';
import type { Repository } from 'typeorm';
import { BalancesService } from '../src/balances/balances.service.js';
import { ResetBalancesProcessor } from '../src/balances/processors/reset-balances.processor.js';
import type { UserEntity } from '../src/users/user.entity.js';

function logger(): PinoLogger {
  return {
    setContext: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  } as unknown as PinoLogger;
}

describe('сброс балансов', () => {
  it('регистрирует одно расписание и ручную задачу без фиксированного jobId', async () => {
    const queue = {
      upsertJobScheduler: vi.fn().mockResolvedValue({}),
      add: vi.fn().mockResolvedValue({ id: 'manual-1' }),
    };
    const service = new BalancesService(logger(), queue as unknown as Queue);

    await service.onModuleInit();
    await service.onModuleInit();
    const accepted = await service.resetBalances();

    expect(queue.upsertJobScheduler).toHaveBeenCalledTimes(2);
    expect(queue.upsertJobScheduler).toHaveBeenCalledWith(
      'reset-all-balances-every-10-minutes',
      { every: 10 * 60 * 1000 },
      expect.objectContaining({ name: 'reset-all-balances' }),
    );
    expect(queue.add).toHaveBeenCalledWith(
      'reset-all-balances',
      {},
      expect.not.objectContaining({ jobId: 'reset-all-balances' }),
    );
    expect(accepted.jobId).toBe('manual-1');
  });

  it('повторная обработка обнуления вызывает тот же условный update', async () => {
    const execute = vi.fn().mockResolvedValue({ affected: 2 });
    const builder = {
      update: vi.fn(),
      set: vi.fn(),
      where: vi.fn(),
      execute,
    };
    builder.update.mockReturnValue(builder);
    builder.set.mockReturnValue(builder);
    builder.where.mockReturnValue(builder);
    const repository = {
      createQueryBuilder: vi.fn().mockReturnValue(builder),
    };
    const processor = new ResetBalancesProcessor(
      repository as unknown as Repository<UserEntity>,
      logger(),
    );
    const job = { id: 'job-1', name: 'reset-all-balances' } as Job;

    await processor.process(job);
    await processor.process(job);

    expect(execute).toHaveBeenCalledTimes(2);
    expect(builder.set).toHaveBeenCalledWith({ balance: '0.00' });
    expect(builder.where).toHaveBeenCalledWith('balance <> 0');
  });
});
