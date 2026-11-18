import { BadRequestException } from '@nestjs/common';
import { Decimal } from 'decimal.js';

export function parseAmount(amount: string): string {
  let value: Decimal;
  try {
    value = new Decimal(amount);
  } catch {
    throw new BadRequestException('Некорректная сумма');
  }

  if (!value.isFinite() || value.lte(0) || value.decimalPlaces() > 2) {
    throw new BadRequestException('Некорректная сумма');
  }

  return value.toFixed(2);
}
