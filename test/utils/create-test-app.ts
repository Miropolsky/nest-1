import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { App } from 'supertest/types';
import { AppModule } from '../../src/app.module.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TC_ENV_PATH = join(__dirname, '..', '.tc-env.json');

function applyTestcontainersEnv() {
  const raw = readFileSync(TC_ENV_PATH, 'utf8');
  const env = JSON.parse(raw) as Record<string, string>;
  for (const [key, value] of Object.entries(env)) {
    process.env[key] = value;
  }
}

export async function createTestApp(): Promise<INestApplication<App>> {
  applyTestcontainersEnv();

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
