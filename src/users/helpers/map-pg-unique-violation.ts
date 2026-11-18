import { QueryFailedError } from 'typeorm';
import {
  UniqueUserField,
  UserUniqueViolationError,
} from '../errors/user-unique-violation.error.js';

type PgDriverError = {
  code?: string;
  detail?: string;
  constraint?: string;
};

export function mapPgUniqueViolation(error: unknown): never {
  if (!isPgUniqueViolation(error)) {
    throw error;
  }

  throw new UserUniqueViolationError(resolveUniqueField(error));
}

function isPgUniqueViolation(error: unknown): boolean {
  return getPgDriverError(error).code === '23505';
}

function resolveUniqueField(error: unknown): UniqueUserField {
  const driverError = getPgDriverError(error);
  const hint =
    `${driverError.constraint ?? ''} ${driverError.detail ?? ''}`.toLowerCase();

  if (hint.includes('login')) {
    return 'login';
  }
  if (hint.includes('email')) {
    return 'email';
  }
  return 'unknown';
}

function getPgDriverError(error: unknown): PgDriverError {
  if (!(error instanceof QueryFailedError)) {
    return {};
  }

  const withDriver = error as QueryFailedError & {
    driverError?: PgDriverError;
    code?: string;
    detail?: string;
    constraint?: string;
  };

  return {
    code: withDriver.driverError?.code ?? withDriver.code,
    detail: withDriver.driverError?.detail ?? withDriver.detail,
    constraint: withDriver.driverError?.constraint ?? withDriver.constraint,
  };
}
