export abstract class OrderApplicationError extends Error {
  abstract readonly code: string;

  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class InvalidCouponError extends OrderApplicationError {
  readonly code = "INVALID_COUPON";

  constructor(couponId: string) {
    super(`쿠폰을 사용 할 수 없습니다. ID: ${couponId}`);
  }
}

export class InsufficientPointBalanceError extends OrderApplicationError {
  readonly code = "INSUFFICIENT_POINT_BALANCE";

  constructor(userId: string, amount: number) {
    super(`잔고가 부족합니다. ID: ${userId}, 금액: ${amount}`);
  }
}

export class OrderNotFoundError extends OrderApplicationError {
  readonly code = "ORDER_NOT_FOUND";

  constructor(orderId: string) {
    super(`주문을 찾을 수 없습니다. ID: ${orderId}`);
  }
}
