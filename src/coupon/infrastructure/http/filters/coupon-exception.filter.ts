import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpStatus,
} from "@nestjs/common";
import { Response } from "express";
import {
  CouponDomainError,
  CouponNotFoundError,
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
  UserCouponNotFoundError,
} from "@/coupon/domain/exceptions/user-coupon.exception";

@Catch(CouponDomainError)
export class CouponExceptionFilter implements ExceptionFilter {
  catch(exception: CouponDomainError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const { status, message } = this.mapCouponErrorToHttp(exception);

    response.status(status).json({
      success: false,
      statusCode: status,
      message: message,
      error: exception.constructor.name,
      code: exception.code,
      timestamp: new Date().toISOString(),
    });
  }

  private mapCouponErrorToHttp(exception: CouponDomainError): {
    status: HttpStatus;
    message: string;
  } {
    switch (exception.constructor) {
      case CouponNotFoundError:
        return {
          status: HttpStatus.NOT_FOUND,
          message: exception.message,
        };

      case InvalidCouponCodeError:
        return {
          status: HttpStatus.BAD_REQUEST,
          message: exception.message,
        };

      case CouponExhaustedError:
        return {
          status: HttpStatus.BAD_REQUEST,
          message: exception.message,
        };

      case CouponExpiredError:
        return {
          status: HttpStatus.BAD_REQUEST,
          message: exception.message,
        };

      case InsufficientOrderPriceError:
        return {
          status: HttpStatus.BAD_REQUEST,
          message: exception.message,
        };

      case InvalidCouponDiscountError:
        return {
          status: HttpStatus.BAD_REQUEST,
          message: exception.message,
        };

      case InvalidCouponDateRangeError:
        return {
          status: HttpStatus.BAD_REQUEST,
          message: exception.message,
        };

      case CannotCancelExhaustedCouponError:
        return {
          status: HttpStatus.BAD_REQUEST,
          message: exception.message,
        };

      case UserCouponExpiredError:
        return {
          status: HttpStatus.BAD_REQUEST,
          message: exception.message,
        };

      case UserCouponAlreadyUsedError:
        return {
          status: HttpStatus.BAD_REQUEST,
          message: exception.message,
        };

      case UserCouponCancelledError:
        return {
          status: HttpStatus.BAD_REQUEST,
          message: exception.message,
        };

      case UserCouponNotFoundError:
        return {
          status: HttpStatus.NOT_FOUND,
          message: exception.message,
        };

      default:
        return {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          message: "쿠폰 처리 중 알 수 없는 오류가 발생했습니다.",
        };
    }
  }
}
