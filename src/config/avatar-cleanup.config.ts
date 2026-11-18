import { registerAs } from '@nestjs/config';
import { getEnv } from './env.schema.js';

export default registerAs('avatarCleanup', () => {
  const env = getEnv();
  return {
    cron: env.AVATAR_CLEANUP_CRON,
    retentionDays: env.AVATAR_CLEANUP_RETENTION_DAYS,
  };
});
