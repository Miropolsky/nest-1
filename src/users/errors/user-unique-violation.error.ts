export type UniqueUserField = 'login' | 'email' | 'unknown';

export class UserUniqueViolationError extends Error {
  readonly field: UniqueUserField;

  constructor(field: UniqueUserField = 'unknown') {
    super('User unique constraint violated');
    this.name = UserUniqueViolationError.name;
    this.field = field;
  }
}
