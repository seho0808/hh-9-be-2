export abstract class CouponApplicationError extends Error {
  abstract readonly code: string;

  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class CouponNotFoundError extends CouponApplicationError {
  readonly code = "COUPON_NOT_FOUND";

  constructor(couponId: string) {
    super(`쿠폰을 찾을 수 없습니다. ID: ${couponId}`);
  }
}

export class UserCouponNotFoundError extends CouponApplicationError {
  readonly code = "USER_COUPON_NOT_FOUND";

  constructor(userCouponId: string) {
    super(`사용자 쿠폰을 찾을 수 없습니다. ID: ${userCouponId}`);
  }
}

export class DuplicateIdempotencyKeyError extends CouponApplicationError {
  readonly code = "DUPLICATE_IDEMPOTENCY_KEY";

  constructor(idempotencyKey: string) {
    super(`중복된 idempotencyKey입니다. 키: ${idempotencyKey}`);
  }
}
