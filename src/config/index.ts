import appConfig from './app.config.js';
import avatarCleanupConfig from './avatar-cleanup.config.js';
import databaseConfig from './database.config.js';
import jwtConfig from './jwt.config.js';
import redisConfig from './redis.config.js';
import s3Config from './s3.config.js';

export const configurations = [
  appConfig,
  databaseConfig,
  jwtConfig,
  s3Config,
  redisConfig,
  avatarCleanupConfig,
];
