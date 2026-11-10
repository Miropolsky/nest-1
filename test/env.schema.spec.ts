import { envSchema, resetEnvCache } from '../src/config/env.schema.js';

const validEnv = {
  PORT: '3000',
  DATABASE_HOST: 'localhost',
  DATABASE_PORT: '5432',
  DATABASE_USER: 'nestuser',
  DATABASE_PASSWORD: 'nestpass',
  DATABASE_NAME: 'nest1',
  JWT_SECRET: 'access',
  JWT_EXPIRES_IN: '60s',
  JWT_REFRESH_SECRET: 'refresh',
  JWT_REFRESH_EXPIRES_IN: '7d',
  S3_REGION: 'us-east-1',
  S3_ENDPOINT: 'http://localhost:9000',
  S3_ACCESS_KEY_ID: 'nestuser',
  S3_SECRET_ACCESS_KEY: 'nestpass',
  S3_BUCKET: 'avatars',
  REDIS_URL: 'redis://localhost:6379',
  REDIS_TTL: '30000',
  AVATAR_CLEANUP_CRON: '0 3 * * *',
  AVATAR_CLEANUP_RETENTION_DAYS: '7',
};

describe('envSchema', () => {
  afterEach(() => {
    resetEnvCache();
  });

  it('принимает корректные значения', () => {
    const parsed = envSchema.parse(validEnv);
    expect(parsed.REDIS_TTL).toBe(30000);
    expect(parsed.AVATAR_CLEANUP_RETENTION_DAYS).toBe(7);
  });

  it('отклоняет REDIS_TTL=abc', () => {
    expect(() => envSchema.parse({ ...validEnv, REDIS_TTL: 'abc' })).toThrow();
  });

  it('отклоняет AVATAR_CLEANUP_RETENTION_DAYS=7abc', () => {
    expect(() =>
      envSchema.parse({
        ...validEnv,
        AVATAR_CLEANUP_RETENTION_DAYS: '7abc',
      }),
    ).toThrow();
  });

  it('отклоняет невалидный REDIS_URL и cron', () => {
    expect(() =>
      envSchema.parse({ ...validEnv, REDIS_URL: 'http://localhost:6379' }),
    ).toThrow();
    expect(() =>
      envSchema.parse({ ...validEnv, AVATAR_CLEANUP_CRON: 'not-a-cron' }),
    ).toThrow();
  });
});
