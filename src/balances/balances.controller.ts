import { Controller, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { BalancesService } from './balances.service.js';

@Controller('balances')
export class BalancesController {
  constructor(private readonly balancesService: BalancesService) {}

  @Post('reset')
  @ApiOperation({ summary: 'Сбросить балансы всех пользователей' })
  @ApiResponse({
    status: HttpStatus.ACCEPTED,
    description: 'Задача на сброс балансов добавлена в очередь',
  })
  async resetBalances() {
    return this.balancesService.resetBalances();
  }
}
