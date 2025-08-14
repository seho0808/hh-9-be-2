import { Catch, HttpStatus } from "@nestjs/common";
import { OrderDomainError } from "@/order/domain/exceptions/order.exceptions";
import {
  OrderApplicationError,
  InvalidCouponError,
  InsufficientPointBalanceError,
  OrderNotFoundError,
} from "@/order/application/order.application.exceptions";
import { ErrorCode } from "@/common/constants/error-codes.enum";
import {
  BaseExceptionFilter,
  ErrorMapping,
} from "@/common/presentation/filters/base-exception.filter";

/**
 * 주문 도메인 예외 처리 필터
 * - 주문 관련 모든 예외를 HTTP 응답으로 변환
 * - 각 예외별로 적절한 상태 코드와 메시지 제공
 */
@Catch(OrderDomainError, OrderApplicationError)
export class OrderExceptionFilter extends BaseExceptionFilter<
  OrderDomainError | OrderApplicationError
> {
  /**
   * 주문 예외를 HTTP 응답으로 매핑
   */
  protected mapErrorToResponse(
    exception: OrderDomainError | OrderApplicationError
  ): ErrorMapping {
    switch (exception.constructor) {
      case OrderNotFoundError:
        return {
          status: HttpStatus.NOT_FOUND,
          message: "주문을 찾을 수 없습니다",
          errorCode: ErrorCode.Order.Application.NOT_FOUND,
        };

      case InvalidCouponError:
        return {
          status: HttpStatus.BAD_REQUEST,
          message: "사용할 수 없는 쿠폰입니다",
          errorCode: ErrorCode.Order.Application.INVALID_COUPON,
        };

      case InsufficientPointBalanceError:
        return {
          status: HttpStatus.BAD_REQUEST,
          message: "잔액이 부족합니다",
          errorCode: ErrorCode.Order.Application.INSUFFICIENT_POINT_BALANCE,
        };

      default:
        return {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          message: "주문 처리 중 알 수 없는 오류가 발생했습니다",
          errorCode: ErrorCode.Infrastructure.INTERNAL_SERVER_ERROR,
        };
    }
  }
}
