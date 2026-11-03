import { Processor, WorkerHost } from '@nestjs/bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Job } from 'bullmq';
import { PinoLogger } from 'nestjs-pino';
import { Repository } from 'typeorm';
import { UserEntity } from '../../users/user.entity.js';

@Processor('balances')
export class ResetBalancesProcessor extends WorkerHost {
  constructor(
    @InjectRepository(UserEntity)
    private readonly usersRepository: Repository<UserEntity>,

    private readonly logger: PinoLogger,
  ) {
    super();
    this.logger.setContext(ResetBalancesProcessor.name);
  }

  async process(job: Job): Promise<void> {
    if (job.name !== 'reset-all-balances') {
      throw new Error(`Unknown job: ${job.name}`);
    }

    this.logger.info({ jobId: job.id }, 'Starting balances reset');

    const result = await this.usersRepository
      .createQueryBuilder()
      .update(UserEntity)
      .set({
        balance: '0.00',
      })
      .where('balance <> 0')
      .execute();

    this.logger.info(
      {
        jobId: job.id,
        affected: result.affected,
      },
      'Balances successfully reset',
    );
  }
}
