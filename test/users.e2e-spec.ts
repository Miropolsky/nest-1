import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { createTestApp } from './utils/create-test-app.js';

describe('Users (e2e)', () => {
  let app: INestApplication<App>;

  const stamp = Date.now();

  const owner = {
    login: `owner_${stamp}`,
    email: `owner_${stamp}@example.com`,
    password: 'password1',
    age: 25,
    description: 'owner',
  };

  const stranger = {
    login: `stranger_${stamp}`,
    email: `stranger_${stamp}@example.com`,
    password: 'password1',
    age: 30,
    description: 'stranger',
  };

  let ownerId: number;
  let ownerToken: string;
  let strangerId: number;
  let strangerToken: string;

  beforeAll(async () => {
    app = await createTestApp();

    const ownerRes = await request(app.getHttpServer())
      .post('/auth/register')
      .send(owner)
      .expect(200);
    ownerToken = ownerRes.body.access_token;

    const ownerProfile = await request(app.getHttpServer())
      .get('/profile/my')
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    ownerId = ownerProfile.body.id;

    const strangerRes = await request(app.getHttpServer())
      .post('/auth/register')
      .send(stranger)
      .expect(200);
    strangerToken = strangerRes.body.access_token;

    const strangerProfile = await request(app.getHttpServer())
      .get('/profile/my')
      .set('Authorization', `Bearer ${strangerToken}`)
      .expect(200);
    strangerId = strangerProfile.body.id;
  });

  afterAll(async () => {
    await app?.close();
  });

  it('GET /users без токена → 401', async () => {
    await request(app.getHttpServer()).get('/users').expect(401);
  });

  it('GET /users → список пользователей', async () => {
    const res = await request(app.getHttpServer())
      .get('/users')
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0]).not.toHaveProperty('password');
  });

  it('GET /users?login= → фильтр по логину', async () => {
    const res = await request(app.getHttpServer())
      .get('/users')
      .query({ login: owner.login })
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(res.body.length).toBeGreaterThanOrEqual(1);
    expect(res.body.every((u: { login: string }) => u.login.includes(owner.login))).toBe(
      true,
    );
  });

  it('GET /users?age=&sortBy=age → фильтр и сортировка', async () => {
    const res = await request(app.getHttpServer())
      .get('/users')
      .query({ age: 25, sortBy: 'age', sortOrder: 'ASC' })
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(res.body.every((u: { age: number }) => u.age === 25)).toBe(true);
  });

  it('PUT /users/:id своего профиля → 200', async () => {
    const res = await request(app.getHttpServer())
      .put(`/users/${ownerId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ description: 'updated bio' })
      .expect(200);

    expect(res.body.description).toBe('updated bio');
    expect(res.body.login).toBe(owner.login);
  });

  it('PUT /users/:id чужого профиля → 403', async () => {
    await request(app.getHttpServer())
      .put(`/users/${strangerId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ description: 'hack' })
      .expect(403);
  });

  it('DELETE /users/:id чужого → 403', async () => {
    await request(app.getHttpServer())
      .delete(`/users/${strangerId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(403);
  });

  it('DELETE /users/:id своего → 204 (soft-delete)', async () => {
    await request(app.getHttpServer())
      .delete(`/users/${ownerId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(204);

    await request(app.getHttpServer())
      .get('/profile/my')
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(404);
  });
});
