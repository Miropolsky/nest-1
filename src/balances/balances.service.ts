import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Queue } from 'bullmq';
import { PinoLogger } from 'nestjs-pino';

@Injectable()
export class BalancesService {
  constructor(
    private readonly logger: PinoLogger,
    @InjectQueue('balances') private readonly balancesQueue: Queue,
  ) {
    this.logger.setContext(BalancesService.name);
  }

  async resetBalances() {
    const job = await this.balancesQueue.add(
      'reset-all-balances',
      {},
      {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
        removeOnComplete: true,
        removeOnFail: false,
        jobId: 'reset-all-balances',
      },
    );

    this.logger.info({ jobId: job.id }, 'Balances reset job added to queue');

    return {
      message: 'Balances reset job added to queue',
      jobId: job.id,
    };
  }

  @Cron('*/10 * * * *')
  async resetBalancesCron() {
    await this.resetBalances();
  }
}
