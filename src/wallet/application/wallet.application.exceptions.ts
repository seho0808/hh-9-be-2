export abstract class WalletApplicationError extends Error {
  abstract readonly code: string;

  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class UserBalanceNotFoundError extends WalletApplicationError {
  readonly code = "USER_BALANCE_NOT_FOUND";

  constructor(userId: string) {
    super(`사용자 잔고를 찾을 수 없습니다. ID: ${userId}`);
  }
}

export class PointTransactionNotFoundError extends WalletApplicationError {
  readonly code = "POINT_TRANSACTION_NOT_FOUND";

  constructor(idempotencyKey: string) {
    super(`사용 금액 트랜잭션을 찾을 수 없습니다. 키: ${idempotencyKey}`);
  }
}

export class DuplicateIdempotencyKeyError extends WalletApplicationError {
  readonly code = "DUPLICATE_IDEMPOTENCY_KEY";

  constructor(idempotencyKey: string) {
    super(`중복된 idempotencyKey입니다. 키: ${idempotencyKey}`);
  }
}
