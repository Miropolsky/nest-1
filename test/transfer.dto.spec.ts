import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { TransferDto } from '../src/users/dto/transfer.dto.js';

describe('TransferDto', () => {
  it('отклоняет recipientId вне диапазона PostgreSQL integer', async () => {
    const dto = plainToInstance(TransferDto, {
      amount: '10.00',
      recipientId: '2147483648',
    });

    const errors = await validate(dto);
    expect(errors.some((error) => error.property === 'recipientId')).toBe(true);
  });

  it('принимает recipientId на верхней границе integer', async () => {
    const dto = plainToInstance(TransferDto, {
      amount: '10.00',
      recipientId: '2147483647',
    });

    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.recipientId).toBe(2147483647);
  });
});
