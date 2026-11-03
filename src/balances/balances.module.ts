import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserEntity } from '../users/user.entity.js';
import { BalancesController } from './balances.controller.js';
import { BalancesService } from './balances.service.js';
import { ResetBalancesProcessor } from './processors/reset-balances.processor.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserEntity]),
    BullModule.registerQueue({
      name: 'balances',
    }),
  ],
  controllers: [BalancesController],
  providers: [BalancesService, ResetBalancesProcessor],
})
export class BalancesModule {}
