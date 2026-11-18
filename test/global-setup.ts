import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const TC_ENV_PATH = join(__dirname, '.tc-env.json');

let container: StartedPostgreSqlContainer | undefined;

export async function setup() {
  container = await new PostgreSqlContainer('postgres:16-alpine')
    .withDatabase('nest1_test')
    .withUsername('test')
    .withPassword('test')
    .start();

  const env = {
    DATABASE_HOST: container.getHost(),
    DATABASE_PORT: String(container.getPort()),
    DATABASE_USER: container.getUsername(),
    DATABASE_PASSWORD: container.getPassword(),
    DATABASE_NAME: container.getDatabase(),
    JWT_SECRET: 'e2e-access-secret',
    JWT_REFRESH_SECRET: 'e2e-refresh-secret',
    JWT_EXPIRES_IN: '1h',
    JWT_REFRESH_EXPIRES_IN: '7d',
    REDIS_URL: process.env.REDIS_URL ?? 'redis://localhost:6379',
    REDIS_TTL: process.env.REDIS_TTL ?? '30000',
    S3_REGION: process.env.S3_REGION ?? 'us-east-1',
    S3_ENDPOINT: process.env.S3_ENDPOINT ?? 'http://localhost:9000',
    S3_ACCESS_KEY_ID: process.env.S3_ACCESS_KEY_ID ?? 'nestuser',
    S3_SECRET_ACCESS_KEY: process.env.S3_SECRET_ACCESS_KEY ?? 'nestpass',
    S3_BUCKET: process.env.S3_BUCKET ?? 'avatars',
    AVATAR_CLEANUP_CRON: process.env.AVATAR_CLEANUP_CRON ?? '0 3 * * *',
    AVATAR_CLEANUP_RETENTION_DAYS:
      process.env.AVATAR_CLEANUP_RETENTION_DAYS ?? '7',
  };

  writeFileSync(TC_ENV_PATH, JSON.stringify(env, null, 2));
}

export async function teardown() {
  await container?.stop();
}
