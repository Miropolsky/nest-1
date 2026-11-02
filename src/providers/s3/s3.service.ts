// src/providers/s3/s3.service.ts
import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { extname } from 'node:path';

export const S3_CLIENT = Symbol('S3_CLIENT');

@Injectable()
export class S3Service {
  private readonly bucketName = 'avatars';

  constructor(@Inject(S3_CLIENT) private readonly s3: S3Client) {}

  async upload(file: Express.Multer.File): Promise<string> {
    const fileName = `${randomUUID()}${extname(file.originalname)}`;

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
