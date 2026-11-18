import { S3Client } from '@aws-sdk/client-s3';
import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3_CLIENT, S3Service } from './s3.service.js';

@Global()
@Module({
  providers: [
    {
      provide: S3_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new S3Client({
          region: config.getOrThrow<string>('s3.region'),
          endpoint: config.getOrThrow<string>('s3.endpoint'),
          forcePathStyle: true,
          credentials: {
            accessKeyId: config.getOrThrow<string>('s3.accessKeyId'),
            secretAccessKey: config.getOrThrow<string>('s3.secretAccessKey'),
          },
        }),
    },
    S3Service,
  ],
  exports: [S3Service],
})
export class S3Module {}
