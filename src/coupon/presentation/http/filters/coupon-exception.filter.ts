import { Catch, HttpStatus } from "@nestjs/common";
import {
  CouponDomainError,
  InvalidCouponCodeError,
  CouponExhaustedError,
  CouponExpiredError,
  InsufficientOrderPriceError,
  InvalidCouponDiscountError,
  InvalidCouponDateRangeError,
  CannotCancelExhaustedCouponError,
} from "@/coupon/domain/exceptions/coupon.exceptions";
import {
  UserCouponExpiredError,
  UserCouponAlreadyUsedError,
  UserCouponCancelledError,
} from "@/coupon/domain/exceptions/user-coupon.exception";
import {
  CouponApplicationError,
  CouponNotFoundError,
  UserCouponNotFoundError,
} from "@/coupon/application/coupon.application.exceptions";
import { ErrorCode } from "@/common/constants/error-codes.enum";
import {
  BaseExceptionFilter,
  ErrorMapping,
} from "@/common/presentation/filters/base-exception.filter";

/**
 * 쿠폰 도메인 및 애플리케이션 예외 처리 필터
 * - 쿠폰 관련 모든 예외를 HTTP 응답으로 변환
 * - 각 예외별로 적절한 상태 코드와 메시지 제공
 */
@Catch(CouponDomainError, CouponApplicationError)
export class CouponExceptionFilter extends BaseExceptionFilter<
  CouponDomainError | CouponApplicationError
> {
  /**
   * 쿠폰 도메인 및 애플리케이션 예외를 HTTP 응답으로 매핑
   */
  protected mapErrorToResponse(
    exception: CouponDomainError | CouponApplicationError
  ): ErrorMapping {
    switch (exception.constructor) {
      // Application Layer Exceptions
      case CouponNotFoundError:
        return {
          status: HttpStatus.NOT_FOUND,
          message: "쿠폰을 찾을 수 없습니다",
          errorCode: ErrorCode.Coupon.Application.COUPON_NOT_FOUND,
        };

      case UserCouponNotFoundError:
        return {
          status: HttpStatus.NOT_FOUND,
          message: "사용자 쿠폰을 찾을 수 없습니다",
          errorCode: ErrorCode.Coupon.Application.USER_COUPON_NOT_FOUND,
        };

      case InvalidCouponCodeError:
        return {
          status: HttpStatus.BAD_REQUEST,
          message: "유효하지 않은 쿠폰 코드입니다",
          errorCode: ErrorCode.Coupon.Domain.INVALID_COUPON_CODE,
        };

      case CouponExhaustedError:
        return {
          status: HttpStatus.BAD_REQUEST,
          message: "쿠폰 재고가 모두 소진되었습니다",
          errorCode: ErrorCode.Coupon.Domain.COUPON_STOCK_EXHAUSTED,
        };

      case CouponExpiredError:
        return {
          status: HttpStatus.BAD_REQUEST,
          message: "만료된 쿠폰입니다",
          errorCode: ErrorCode.Coupon.Domain.COUPON_EXPIRED,
        };

      case InsufficientOrderPriceError:
        return {
          status: HttpStatus.BAD_REQUEST,
          message: "최소 주문 금액이 부족합니다",
          errorCode: ErrorCode.Coupon.Domain.COUPON_NOT_ACTIVE,
        };

      case InvalidCouponDiscountError:
        return {
          status: HttpStatus.BAD_REQUEST,
          message: "유효하지 않은 쿠폰 할인입니다",
          errorCode: ErrorCode.Coupon.Domain.COUPON_NOT_ACTIVE,
        };

      case InvalidCouponDateRangeError:
        return {
          status: HttpStatus.BAD_REQUEST,
          message: "쿠폰 사용 기간이 아닙니다",
          errorCode: ErrorCode.Coupon.Domain.COUPON_NOT_ACTIVE,
        };

      case CannotCancelExhaustedCouponError:
        return {
          status: HttpStatus.BAD_REQUEST,
          message: "소진된 쿠폰은 취소할 수 없습니다",
          errorCode: ErrorCode.Coupon.Domain.COUPON_STOCK_EXHAUSTED,
        };

      case UserCouponExpiredError:
        return {
          status: HttpStatus.BAD_REQUEST,
          message: "만료된 사용자 쿠폰입니다",
          errorCode: ErrorCode.Coupon.Domain.USER_COUPON_EXPIRED,
        };

      case UserCouponAlreadyUsedError:
        return {
          status: HttpStatus.BAD_REQUEST,
          message: "이미 사용된 쿠폰입니다",
          errorCode: ErrorCode.Coupon.Domain.USER_COUPON_ALREADY_USED,
        };

      case UserCouponCancelledError:
        return {
          status: HttpStatus.BAD_REQUEST,
          message: "취소된 쿠폰입니다",
          errorCode: ErrorCode.Coupon.Domain.USER_COUPON_ALREADY_CANCELLED,
        };

      default:
        return {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          message: "쿠폰 처리 중 알 수 없는 오류가 발생했습니다",
          errorCode: ErrorCode.Infrastructure.INTERNAL_SERVER_ERROR,
        };
    }
  }
}
