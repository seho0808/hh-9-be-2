import { CouponDiscountType } from "../entities/coupon.entity";

export abstract class CouponDomainError extends Error {
  abstract readonly code: string;

  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class InvalidCouponCodeError extends CouponDomainError {
  readonly code = "INVALID_COUPON_CODE";

  constructor(couponCode: string) {
    super(`쿠폰 코드가 유효하지 않습니다. 코드: ${couponCode}`);
  }
}

export class CouponExpiredError extends CouponDomainError {
  readonly code = "COUPON_EXPIRED";

  constructor(couponId: string, endDate: Date) {
    super(`쿠폰이 만료되었습니다. ID: ${couponId}, 만료일: ${endDate}`);
  }
}

export class CouponExhaustedError extends CouponDomainError {
  readonly code = "COUPON_EXHAUSTED";

  constructor(couponId: string) {
    super(`쿠폰 재고가 소진되었습니다. ID: ${couponId}`);
  }
}

export class InsufficientOrderPriceError extends CouponDomainError {
  readonly code = "INSUFFICIENT_ORDER_PRICE";

  constructor(couponId: string, minimumOrderPrice: number, orderPrice: number) {
    super(
      `주문 금액이 쿠폰 사용 최소 금액보다 적습니다. 쿠폰ID: ${couponId}, 최소금액: ${minimumOrderPrice}, 주문금액: ${orderPrice}`
    );
  }
}

export class InvalidCouponDateRangeError extends CouponDomainError {
  readonly code = "INVALID_COUPON_DATE_RANGE";

  constructor(startDate: Date, endDate: Date) {
    super(
      `쿠폰 발급 기간이 유효하지 않습니다. 시작일: ${startDate}, 종료일: ${endDate}`
    );
  }
}

export class InvalidCouponDiscountError extends CouponDomainError {
  readonly code = "INVALID_COUPON_DISCOUNT";

  constructor(discountType: CouponDiscountType, discountValue: number) {
    super(
      `쿠폰 할인 금액이 유효하지 않습니다. 할인 타입: ${discountType}, 할인 금액: ${discountValue}`
    );
  }
}

export class CannotCancelExhaustedCouponError extends CouponDomainError {
  readonly code = "CANNOT_CANCEL_EXHAUSTED_COUPON";

  constructor(couponId: string) {
    super(`쿠폰을 취소할 수 없습니다. ID: ${couponId}`);
  }
}

export class UserCouponAlreadyIssuedError extends CouponDomainError {
  readonly code = "USER_COUPON_ALREADY_ISSUED";

  constructor(userCouponId: string) {
    super(`이미 발급된 쿠폰입니다. ID: ${userCouponId}`);
  }
}
