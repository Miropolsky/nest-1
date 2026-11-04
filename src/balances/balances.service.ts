import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { Queue } from 'bullmq';
import { PinoLogger } from 'nestjs-pino';

const RESET_JOB = 'reset-all-balances';
const RESET_EVERY_MS = 10 * 60 * 1000;

const resetJobOptions = {
  attempts: 3,
  backoff: {
    type: 'exponential' as const,
    delay: 5000,
  },
  removeOnComplete: true,
  removeOnFail: 100,
};

@Injectable()
export class BalancesService implements OnModuleInit {
  constructor(
    private readonly logger: PinoLogger,
    @InjectQueue('balances') private readonly balancesQueue: Queue,
  ) {
    this.logger.setContext(BalancesService.name);
  }

  async onModuleInit(): Promise<void> {
    await this.balancesQueue.upsertJobScheduler(
      'reset-all-balances-every-10-minutes',
      { every: RESET_EVERY_MS },
      {
        name: RESET_JOB,
        data: {},
        opts: resetJobOptions,
      },
    );
    this.logger.info('Balances reset scheduler registered');
  }

  async resetBalances() {
    const job = await this.balancesQueue.add(RESET_JOB, {}, resetJobOptions);

    this.logger.info({ jobId: job.id }, 'Balances reset job added to queue');

    return {
      message: 'Balances reset job added to queue',
      jobId: job.id,
    };
  }
}
