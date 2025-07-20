export abstract class UserDomainError extends Error {
  abstract readonly code: string;

  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class EmailDuplicateError extends UserDomainError {
  readonly code = "EMAIL_DUPLICATE";

  constructor(email: string) {
    super(`이미 사용 중인 이메일입니다: ${email}`);
  }
}

export class InvalidEmailFormatError extends UserDomainError {
  readonly code = "INVALID_EMAIL_FORMAT";

  constructor(email: string) {
    super(`유효하지 않은 이메일 형식입니다: ${email}`);
  }
}

export class InvalidUserNameError extends UserDomainError {
  readonly code = "INVALID_USER_NAME";

  constructor(name: string) {
    super(`유효하지 않은 사용자 이름입니다: ${name}`);
  }
}

export class UserNotFoundError extends UserDomainError {
  readonly code = "USER_NOT_FOUND";

  constructor(identifier: string) {
    super(`사용자를 찾을 수 없습니다: ${identifier}`);
  }
}

export class RepositoryError extends UserDomainError {
  readonly code = "REPOSITORY_ERROR";

  constructor(operation: string, cause?: Error) {
    super(
      `리포지토리 오류 (${operation}): ${cause?.message || "알 수 없는 오류"}`
    );
    if (cause) {
      this.stack = cause.stack;
    }
  }
}
