import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpStatus,
  BadRequestException,
} from "@nestjs/common";
import { Response } from "express";
import {
  PointDomainError,
  UserBalanceNotFoundError,
  InsufficientPointBalanceError,
  InvalidChargeAmountError,
  InvalidUseAmountError,
} from "@/wallet/domain/exceptions/point.exceptions";

@Catch(PointDomainError, BadRequestException)
export class WalletExceptionFilter implements ExceptionFilter {
  catch(
    exception: PointDomainError | BadRequestException,
    host: ArgumentsHost
  ) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    console.log(
      "!@# WalletExceptionFilter caught:",
      exception.constructor.name
    );

    if (exception instanceof BadRequestException) {
      // ValidationPipe의 BadRequestException 처리
      const exceptionResponse = exception.getResponse() as any;

      response.status(HttpStatus.BAD_REQUEST).json({
        success: false,
        statusCode: HttpStatus.BAD_REQUEST,
        message: Array.isArray(exceptionResponse.message)
          ? exceptionResponse.message
          : [exceptionResponse.message || exception.message],
        error: "ValidationError",
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const { status, message } = this.mapWalletErrorToHttp(
      exception as PointDomainError
    );

    response.status(status).json({
      success: false,
      statusCode: status,
      message: message,
      error: exception.constructor.name,
      code: exception.code,
      timestamp: new Date().toISOString(),
    });
  }

  private mapWalletErrorToHttp(exception: PointDomainError): {
    status: HttpStatus;
    message: string;
  } {
    switch (exception.constructor) {
      case UserBalanceNotFoundError:
        return {
          status: HttpStatus.NOT_FOUND,
          message: exception.message,
        };

      case InsufficientPointBalanceError:
        return {
          status: HttpStatus.BAD_REQUEST,
          message: exception.message,
        };

      case InvalidChargeAmountError:
        return {
          status: HttpStatus.BAD_REQUEST,
          message: exception.message,
        };

      case InvalidUseAmountError:
        return {
          status: HttpStatus.BAD_REQUEST,
          message: exception.message,
        };

      default:
        return {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          message: "포인트 처리 중 알 수 없는 오류가 발생했습니다.",
        };
    }
  }
}
