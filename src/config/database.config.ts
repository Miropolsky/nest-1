import { registerAs } from '@nestjs/config';
import { getEnv } from './env.schema.js';

export type DatabaseConfig = {
  host: string;
  port: number;
  user: string;
  password: string;
  name: string;
};

export function databaseConfigFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): DatabaseConfig {
  const parsed = getEnv(env);
  return {
    host: parsed.DATABASE_HOST,
    port: parsed.DATABASE_PORT,
    user: parsed.DATABASE_USER,
    password: parsed.DATABASE_PASSWORD,
    name: parsed.DATABASE_NAME,
  };
}

export default registerAs('database', () => databaseConfigFromEnv());
