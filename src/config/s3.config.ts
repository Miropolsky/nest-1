import { registerAs } from '@nestjs/config';
import { getEnv } from './env.schema.js';

export default registerAs('s3', () => {
  const env = getEnv();
  return {
    region: env.S3_REGION,
    endpoint: env.S3_ENDPOINT,
    accessKeyId: env.S3_ACCESS_KEY_ID,
    secretAccessKey: env.S3_SECRET_ACCESS_KEY,
    bucket: env.S3_BUCKET,
  };
});
