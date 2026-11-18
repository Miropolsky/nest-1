import { CLS_ID, ClsService } from 'nestjs-cls';
import { randomUUID } from 'node:crypto';

export function resolveRequestId(cls: ClsService, fallback?: string): string {
  if (fallback) {
    return fallback;
  }
  if (cls.isActive()) {
    const current = cls.getId();
    if (current) {
      return current;
    }
  }
  return randomUUID();
}

export function runWithRequestId<T>(
  cls: ClsService,
  requestId: string,
  callback: () => T,
): T {
  if (cls.isActive() && cls.getId() === requestId) {
    return callback();
  }

  return cls.run(() => {
    cls.set(CLS_ID, requestId);
    return callback();
  });
}
