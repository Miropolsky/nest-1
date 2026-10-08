import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { createTestApp } from './utils/create-test-app.js';

describe('Auth + Profile (e2e)', () => {
  let app: INestApplication<App>;

  const user = {
    login: `auth_${Date.now()}`,
    email: `auth_${Date.now()}@example.com`,
    password: 'password1',
    age: 20,
    description: 'test user',
  };

  let accessToken: string;
  let refreshToken: string;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('POST /auth/register → выдаёт access и refresh токены', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send(user)
      .expect(200);

    expect(res.body).toHaveProperty('access_token');
    expect(res.body).toHaveProperty('refresh_token');

    accessToken = res.body.access_token;
    refreshToken = res.body.refresh_token;
  });

  it('POST /auth/register с тем же login → 409', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        ...user,
        email: `other_${Date.now()}@example.com`,
      })
      .expect(409);
  });

  it('POST /auth/register с тем же email → 409', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        ...user,
        login: `other_${Date.now()}`,
      })
      .expect(409);
  });

  it('GET /profile/my без токена → 401', async () => {
    await request(app.getHttpServer()).get('/profile/my').expect(401);
  });

  it('GET /profile/my с access_token → свой профиль', async () => {
    const res = await request(app.getHttpServer())
      .get('/profile/my')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body.login).toBe(user.login);
    expect(res.body.email).toBe(user.email);
    expect(res.body.age).toBe(user.age);
    expect(res.body).not.toHaveProperty('password');
  });

  it('POST /auth/login с неверным паролем → 401', async () => {
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ login: user.login, password: 'wrong' })
      .expect(401);
  });

  it('POST /auth/login → новые токены', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ login: user.login, password: user.password })
      .expect(200);

    expect(res.body).toHaveProperty('access_token');
    expect(res.body).toHaveProperty('refresh_token');

    accessToken = res.body.access_token;
    refreshToken = res.body.refresh_token;
  });

  it('POST /auth/refresh → обновляет пару токенов и инвалидирует старый refresh', async () => {
    const oldRefreshToken = refreshToken;

    const res = await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refresh_token: oldRefreshToken })
      .expect(200);

    expect(res.body).toHaveProperty('access_token');
    expect(res.body).toHaveProperty('refresh_token');
    expect(res.body.refresh_token).not.toBe(oldRefreshToken);

    accessToken = res.body.access_token;
    refreshToken = res.body.refresh_token;

    await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refresh_token: oldRefreshToken })
      .expect(401);
  });

  it('POST /auth/refresh с мусором → 401', async () => {
    await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refresh_token: 'not-a-real-token' })
      .expect(401);
  });
});
