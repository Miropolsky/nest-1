import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { createTestApp } from './utils/create-test-app.js';

describe('Transfer (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;

  const stamp = Date.now();

  const sender = {
    login: `sender_${stamp}`,
    email: `sender_${stamp}@example.com`,
    password: 'password1',
    age: 25,
    description: 'sender',
  };

  const recipient = {
    login: `recipient_${stamp}`,
    email: `recipient_${stamp}@example.com`,
    password: 'password1',
    age: 30,
    description: 'recipient',
  };

  let senderId: number;
  let senderToken: string;
  let recipientId: number;
  let recipientToken: string;

  beforeAll(async () => {
    app = await createTestApp();
    dataSource = app.get(DataSource);

    const senderRes = await request(app.getHttpServer())
      .post('/auth/register')
      .send(sender)
      .expect(200);
    senderToken = senderRes.body.access_token;

    const senderProfile = await request(app.getHttpServer())
      .get('/profile/my')
      .set('Authorization', `Bearer ${senderToken}`)
      .expect(200);
    senderId = senderProfile.body.id;

    const recipientRes = await request(app.getHttpServer())
      .post('/auth/register')
      .send(recipient)
      .expect(200);
    recipientToken = recipientRes.body.access_token;

    const recipientProfile = await request(app.getHttpServer())
      .get('/profile/my')
      .set('Authorization', `Bearer ${recipientToken}`)
      .expect(200);
    recipientId = recipientProfile.body.id;
  });

  afterAll(async () => {
    await app?.close();
  });

  it('десять параллельных переводов в PostgreSQL сохраняют сумму и оба баланса', async () => {
    await dataSource.query(
      `UPDATE "user_entity" SET balance = $1 WHERE id = $2`,
      ['50.00', senderId],
    );
    await dataSource.query(
      `UPDATE "user_entity" SET balance = $1 WHERE id = $2`,
      ['0.00', recipientId],
    );

    const results = await Promise.all(
      Array.from({ length: 10 }, () =>
        request(app.getHttpServer())
          .post('/users/transfer')
          .set('Authorization', `Bearer ${senderToken}`)
          .send({ amount: '10.00', recipientId }),
      ),
    );

    const succeeded = results.filter((res) => res.status === 200);
    const rejected = results.filter((res) => res.status === 400);

    expect(succeeded).toHaveLength(5);
    expect(rejected).toHaveLength(5);

    const rows = (await dataSource.query(
      `SELECT id, balance::text AS balance
       FROM "user_entity"
       WHERE id = ANY($1::int[])
       ORDER BY id`,
      [[senderId, recipientId]],
    )) as Array<{ id: number; balance: string }>;

    const balances = Object.fromEntries(
      rows.map((row) => [row.id, Number(row.balance)]),
    );

    expect(balances[senderId]).toBe(0);
    expect(balances[recipientId]).toBe(50);
    expect(balances[senderId] + balances[recipientId]).toBe(50);
    expect(balances[senderId]).toBeGreaterThanOrEqual(0);
    expect(balances[recipientId]).toBeGreaterThanOrEqual(0);

    const senderProfile = await request(app.getHttpServer())
      .get('/profile/my')
      .set('Authorization', `Bearer ${senderToken}`)
      .expect(200);
    const recipientProfile = await request(app.getHttpServer())
      .get('/profile/my')
      .set('Authorization', `Bearer ${recipientToken}`)
      .expect(200);

    expect(senderProfile.body.balance).toBe('0.00');
    expect(recipientProfile.body.balance).toBe('50.00');
  });
});
