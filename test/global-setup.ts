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
  };

  writeFileSync(TC_ENV_PATH, JSON.stringify(env, null, 2));
}

export async function teardown() {
  await container?.stop();
}
