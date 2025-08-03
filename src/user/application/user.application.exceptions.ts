export abstract class UserApplicationError extends Error {
  abstract readonly code: string;

  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class UserNotFoundError extends UserApplicationError {
  readonly code = "USER_NOT_FOUND";

  constructor(userId: string) {
    super(`사용자를 찾을 수 없습니다. ID: ${userId}`);
  }
}
