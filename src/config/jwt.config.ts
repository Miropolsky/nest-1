import { registerAs } from '@nestjs/config';
import { getEnv } from './env.schema.js';

export default registerAs('jwt', () => {
  const env = getEnv();
  return {
    secret: env.JWT_SECRET,
    expiresIn: env.JWT_EXPIRES_IN,
    refreshSecret: env.JWT_REFRESH_SECRET,
    refreshExpiresIn: env.JWT_REFRESH_EXPIRES_IN,
  };
});
