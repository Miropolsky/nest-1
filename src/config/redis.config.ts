import { registerAs } from '@nestjs/config';
import { getEnv } from './env.schema.js';

export default registerAs('redis', () => {
  const env = getEnv();
  return {
    url: env.REDIS_URL,
    ttl: env.REDIS_TTL,
  };
});
