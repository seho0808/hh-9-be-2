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

export class UserCouponRecoverOrderIdMismatchError extends CouponDomainError {
  readonly code = "USER_COUPON_RECOVER_ORDER_ID_MISMATCH";

  constructor(userCouponId: string, orderId: string) {
    super(
      `쿠폰 복구를 위한 주문 ID가 일치하지 않습니다. ID: ${userCouponId}, 주문 ID: ${orderId}`
    );
  }
}

export class CouponReservationConfirmStatusNotPendingError extends CouponDomainError {
  readonly code = "COUPON_RESERVATION_CONFIRM_STATUS_NOT_PENDING";

  constructor(reservationId: string) {
    super(`쿠폰 예약 상태가 PENDING가 아닙니다. ID: ${reservationId}`);
  }
}
