import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module.js';
import { resetEnvCache } from '../../src/config/env.schema.js';
import { AddActiveUserIndexes1793655840321 } from '../../src/database/migrations/1793655840321-AddActiveUserIndexes.js';
import { AddAvatarToUser1793567513444 } from '../../src/database/migrations/1793567513444-AddAvatarToUser.js';
import { AddBalanceToUser1793714095819 } from '../../src/database/migrations/1793714095819-AddBalanceToUser.js';
import { AddRefreshTokenHashToUser1793569914635 } from '../../src/database/migrations/1793569914635-AddRefreshTokenHashToUser.js';
import { CreateAvatarEntity1793652931832 } from '../../src/database/migrations/1793652931832-CreateAvatarEntity.js';
import { CreateUserEntity1793567513400 } from '../../src/database/migrations/1793567513400-CreateUserEntity.js';
import { UseTimestamptzForEventDates1794240000000 } from '../../src/database/migrations/1794240000000-UseTimestamptzForEventDates.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TC_ENV_PATH = join(__dirname, '..', '.tc-env.json');

const migrations = [
  CreateUserEntity1793567513400,
  AddAvatarToUser1793567513444,
  AddRefreshTokenHashToUser1793569914635,
  CreateAvatarEntity1793652931832,
  AddActiveUserIndexes1793655840321,
  AddBalanceToUser1793714095819,
  UseTimestamptzForEventDates1794240000000,
];

function applyTestcontainersEnv() {
  const raw = readFileSync(TC_ENV_PATH, 'utf8');
  const env = JSON.parse(raw) as Record<string, string>;
  for (const [key, value] of Object.entries(env)) {
    process.env[key] = value;
  }
  resetEnvCache();
}

async function runMigrations() {
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DATABASE_HOST,
    port: Number(process.env.DATABASE_PORT ?? 5432),
    username: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME,
    migrations,
  });

  await dataSource.initialize();
  await dataSource.runMigrations();
  await dataSource.destroy();
}

export async function createTestApp(): Promise<INestApplication<App>> {
  applyTestcontainersEnv();
  await runMigrations();

  const moduleFixture = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleFixture.createNestApplication();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
        exposeDefaultValues: true,
      },
    }),
  );
  await app.init();
  return app;
}
