import { CouponDomainError } from "./coupon.exceptions";

export class UserCouponExpiredError extends CouponDomainError {
  readonly code = "USER_COUPON_EXPIRED";

  constructor(userCouponId: string) {
    super(`만료된 쿠폰입니다. ID: ${userCouponId}`);
  }
}

export class UserCouponAlreadyUsedError extends CouponDomainError {
  readonly code = "USER_COUPON_ALREADY_USED";

  constructor(userCouponId: string) {
    super(`이미 사용된 쿠폰입니다. ID: ${userCouponId}`);
  }
}

export class UserCouponCancelledError extends CouponDomainError {
  readonly code = "USER_COUPON_CANCELLED";

  constructor(userCouponId: string) {
    super(`취소된 쿠폰입니다. ID: ${userCouponId}`);
  }
}

export class UserCouponNotFoundError extends CouponDomainError {
  readonly code = "USER_COUPON_NOT_FOUND";

  constructor(userCouponId: string) {
    super(`존재하지 않는 쿠폰입니다. ID: ${userCouponId}`);
  }
}
