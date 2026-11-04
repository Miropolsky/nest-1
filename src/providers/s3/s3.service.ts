import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';

export const S3_CLIENT = Symbol('S3_CLIENT');

@Injectable()
export class S3Service {
  private readonly bucketName: string;

  constructor(
    @Inject(S3_CLIENT) private readonly s3: S3Client,
    config: ConfigService,
  ) {
    this.bucketName = config.getOrThrow<string>('s3.bucket');
  }

  async upload(file: Express.Multer.File): Promise<string> {
    const extension = file.mimetype === 'image/png' ? 'png' : 'jpg';
    const fileName = `avatars/${randomUUID()}.${extension}`;

    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucketName,
        Key: fileName,
        Body: file.buffer,
        ContentType: file.mimetype,
      }),
    );

    return fileName;
  }

  async remove(fileName: string): Promise<void> {
    await this.s3.send(
      new DeleteObjectCommand({ Bucket: this.bucketName, Key: fileName }),
    );
  }
}
