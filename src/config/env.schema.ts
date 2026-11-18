import { CronTime } from 'cron';
import { z } from 'zod';

const positiveIntString = z
  .string()
  .regex(/^[1-9]\d*$/, 'must be a positive integer')
  .transform((value) => Number(value))
  .pipe(z.number().int().positive());

const positiveIntStringAllowZeroPrefix = z
  .string()
  .regex(/^\d+$/, 'must be a non-negative integer')
  .transform((value) => Number(value))
  .pipe(z.number().int().positive());

function withDefault(raw: unknown, fallback: string): unknown {
  if (raw === undefined || raw === null || raw === '') {
    return fallback;
  }
  return raw;
}

function isRedisUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'redis:' || url.protocol === 'rediss:';
  } catch {
    return false;
  }
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function isCronExpression(value: string): boolean {
  try {
    new CronTime(value);
    return true;
  } catch {
    return false;
  }
}

export const envSchema = z.object({
  PORT: z.preprocess((value) => withDefault(value, '3000'), positiveIntString),

  DATABASE_HOST: z.string().min(1),
  DATABASE_PORT: z.preprocess(
    (value) => withDefault(value, '5432'),
    positiveIntString,
  ),
  DATABASE_USER: z.string().min(1),
  DATABASE_PASSWORD: z.string().min(1),
  DATABASE_NAME: z.string().min(1),

  JWT_SECRET: z.string().min(1),
  JWT_EXPIRES_IN: z.preprocess(
    (value) => withDefault(value, '60s'),
    z.string().min(1),
  ),
  JWT_REFRESH_SECRET: z.string().min(1),
  JWT_REFRESH_EXPIRES_IN: z.preprocess(
    (value) => withDefault(value, '7d'),
    z.string().min(1),
  ),

  S3_REGION: z.string().min(1),
  S3_ENDPOINT: z
    .string()
    .min(1)
    .refine(isHttpUrl, 'S3_ENDPOINT must be an http(s) URL'),
  S3_ACCESS_KEY_ID: z.string().min(1),
  S3_SECRET_ACCESS_KEY: z.string().min(1),
  S3_BUCKET: z.string().min(1),

  REDIS_URL: z
    .string()
    .min(1)
    .refine(isRedisUrl, 'REDIS_URL must be a redis:// or rediss:// URL'),
  REDIS_TTL: z.preprocess(
    (value) => withDefault(value, '30000'),
    positiveIntStringAllowZeroPrefix,
  ),

  AVATAR_CLEANUP_CRON: z.preprocess(
    (value) => withDefault(value, '0 3 * * *'),
    z
      .string()
      .min(1)
      .refine(isCronExpression, 'AVATAR_CLEANUP_CRON must be a valid cron'),
  ),
  AVATAR_CLEANUP_RETENTION_DAYS: z.preprocess(
    (value) => withDefault(value, '7'),
    positiveIntString,
  ),
});

export type Env = z.infer<typeof envSchema>;

let cachedEnv: Env | undefined;

export function getEnv(
  env: NodeJS.ProcessEnv | Record<string, unknown> = process.env,
): Env {
  if (cachedEnv && env === process.env) {
    return cachedEnv;
  }

  const parsed = envSchema.parse(env);
  if (env === process.env) {
    cachedEnv = parsed;
  }
  return parsed;
}

export function validateEnv(
  config: Record<string, unknown>,
): Record<string, unknown> {
  const parsed = envSchema.safeParse(config);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join('.') || 'env'}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid environment variables: ${details}`);
  }

  cachedEnv = parsed.data;
  return config;
}

/** @internal test helper */
export function resetEnvCache(): void {
  cachedEnv = undefined;
}
