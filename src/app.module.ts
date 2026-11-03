import { createKeyv } from '@keyv/redis';
import { CacheModule } from '@nestjs/cache-manager';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import type { Request, Response } from 'express';
import { ClsModule, ClsService } from 'nestjs-cls';
import { LoggerModule, PinoLogger } from 'nestjs-pino';
import { randomUUID } from 'node:crypto';
import { AuthGuard } from './auth/auth.guard.js';
import { AuthModule } from './auth/auth.module.js';
import { AvatarsModule } from './avatars/avatars.module.js';
import configuration from './config/configuration.js';
import { S3Module } from './providers/s3/s3.module.js';
import { UsersModule } from './users/users.module.js';

type RequestWithId = Request & { id?: string };

function resolveRequestId(req: RequestWithId): string {
  if (req.id) {
    return req.id;
  }

  const header = req.headers['x-request-id'];
  const requestId = Array.isArray(header) ? header[0] : header;
  return requestId || randomUUID();
}

@Module({
  imports: [
    ClsModule.forRoot({
      global: true,
      middleware: {
        mount: true,
        generateId: true,
        idGenerator: (req: RequestWithId) => resolveRequestId(req),
        setup: (cls: ClsService, req: RequestWithId, res: Response) => {
          const requestId = cls.getId();
          req.id = requestId;
          res.setHeader('x-request-id', requestId);
        },
      },
    }),
    LoggerModule.forRootAsync({
      imports: [ClsModule],
      inject: [ClsService],
      useFactory: (cls: ClsService) => ({
        pinoHttp: {
          genReqId: (req: RequestWithId, res: Response) => {
            if (cls.isActive() && cls.getId()) {
              return cls.getId();
            }

            const requestId = resolveRequestId(req);
            res.setHeader('x-request-id', requestId);
            return requestId;
          },
          mixin: () => {
            if (!cls.isActive()) {
              return {};
            }

            const requestId = cls.getId();
            return requestId ? { requestId } : {};
          },
          redact: [
            'req.headers.authorization',
            'req.headers.cookie',
            'req.body.password',
            'req.body.access_token',
            'req.body.refresh_token',
            'password',
            'access_token',
            'refresh_token',
          ],
        },
      }),
    }),
    UsersModule,
    ConfigModule.forRoot({
      load: [configuration],
      isGlobal: true,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres' as const,
        host: config.getOrThrow<string>('database.host'),
        port: config.getOrThrow<number>('database.port'),
        username: config.getOrThrow<string>('database.user'),
        password: config.getOrThrow<string>('database.password'),
        database: config.getOrThrow<string>('database.name'),
        autoLoadEntities: true,
        synchronize: false,
      }),
    }),
    CacheModule.registerAsync({
      isGlobal: true,
      inject: [ConfigService, PinoLogger],
      useFactory: (config: ConfigService, logger: PinoLogger) => {
        logger.setContext('Redis');
        const store = createKeyv(config.getOrThrow<string>('redis.url'));
        store.on('error', (error: unknown) => {
          logger.error(
            { name: error instanceof Error ? error.name : 'UnknownError' },
            'Redis error',
          );
        });

        return {
          stores: [store],
          ttl: config.getOrThrow<number>('redis.ttl'),
        };
      },
    }),
    AuthModule,
    S3Module,
    AvatarsModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
  ],
})
export class AppModule {}
