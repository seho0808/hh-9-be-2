import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpStatus,
} from "@nestjs/common";
import { Response } from "express";
import {
  OrderDomainError,
  OrderNotFoundError,
} from "@/order/domain/exceptions/order.exceptions";
import {
  OrderApplicationError,
  InvalidCouponError,
  InsufficientPointBalanceError,
} from "@/order/application/order.exceptions";

@Catch(OrderDomainError, OrderApplicationError)
export class OrderExceptionFilter implements ExceptionFilter {
  catch(
    exception: OrderDomainError | OrderApplicationError,
    host: ArgumentsHost
  ) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const { status, message } = this.mapOrderErrorToHttp(exception);

    response.status(status).json({
      statusCode: status,
      message: message,
      error: exception.constructor.name,
      code: exception.code,
      timestamp: new Date().toISOString(),
    });
  }

  private mapOrderErrorToHttp(
    exception: OrderDomainError | OrderApplicationError
  ): {
    status: HttpStatus;
    message: string;
  } {
    switch (exception.constructor) {
      case OrderNotFoundError:
        return {
          status: HttpStatus.NOT_FOUND,
          message: "주문을 찾을 수 없습니다.",
        };

      case InvalidCouponError:
        return {
          status: HttpStatus.BAD_REQUEST,
          message: "사용할 수 없는 쿠폰입니다.",
        };

      case InsufficientPointBalanceError:
        return {
          status: HttpStatus.BAD_REQUEST,
          message: "잔액이 부족합니다.",
        };

      default:
        return {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          message: "주문 처리 중 알 수 없는 오류가 발생했습니다.",
        };
    }
  }
}
