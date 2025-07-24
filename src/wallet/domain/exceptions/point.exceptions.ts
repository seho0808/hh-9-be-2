export abstract class PointDomainError extends Error {
  abstract readonly code: string;

  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class UserBalanceNotFoundError extends PointDomainError {
  readonly code = "USER_BALANCE_NOT_FOUND";

  constructor(userId: string) {
    super(`유저 잔액을 찾을 수 없습니다. ID: ${userId}`);
  }
}

export class InsufficientPointBalanceError extends PointDomainError {
  readonly code = "INSUFFICIENT_POINT_BALANCE";

  constructor(userId: string, balance: number, required: number) {
    super(
      `유저 잔액이 부족합니다. ID: ${userId}, 현재 잔액: ${balance}, 필요 잔액: ${required}`
    );
  }
}

export class InvalidChargeAmountError extends PointDomainError {
  readonly code = "INVALID_CHARGE_AMOUNT";

  constructor(amount: number) {
    super(
      `유효하지 않은 충전 금액입니다. 최소/최대 충전 금액, 충전 단위, 최소/최대 잔액 범위를 확인해주세요. 충전 금액: ${amount}`
    );
  }
}

export class InvalidUseAmountError extends PointDomainError {
  readonly code = "INVALID_USE_AMOUNT";

  constructor(amount: number) {
    super(
      `유효하지 않은 사용 금액입니다. 최소/최대 잔액 범위를 확인해주세요. 사용 금액: ${amount}`
    );
  }
}
