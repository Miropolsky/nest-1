import { registerAs } from '@nestjs/config';
import { getEnv } from './env.schema.js';

export default registerAs('app', () => {
  const env = getEnv();
  return {
    port: env.PORT,
  };
});
