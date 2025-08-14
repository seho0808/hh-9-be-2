import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
  BadRequestException,
} from "@nestjs/common";
import { Response, Request } from "express";
import { StandardErrorResponseDto } from "@/common/presentation/dto/standard-error-response.dto";
import { ErrorCode } from "@/common/constants/error-codes.enum";

/**
 * 전역 예외 처리 필터
 * - 모든 처리되지 않은 예외를 캐치하여 일관된 응답 형식 제공
 * - ValidationPipe의 BadRequestException, HttpException, Error, 알 수 없는 예외 등을 처리
 * - 도메인별 예외는 각 도메인의 ExceptionFilter에서 처리
 * - 개발 환경에서는 디버깅을 위한 추가 정보 제공
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const exceptionInfo = this.analyzeException(exception);

    const errorResponse = new StandardErrorResponseDto(
      exceptionInfo.status,
      exceptionInfo.message,
      exceptionInfo.code,
      exceptionInfo.error,
      (request.headers["x-correlation-id"] as string) || `req-${Date.now()}`,
      exceptionInfo.details
    );

    response.status(exceptionInfo.status).json(errorResponse);
  }

  /**
   * 예외 타입별 분석 및 매핑
   */
  private analyzeException(exception: unknown) {
    // ValidationPipe의 BadRequestException을 우선 처리
    if (exception instanceof BadRequestException) {
      return this.handleValidationException(exception);
    }

    if (exception instanceof HttpException) {
      return this.handleHttpException(exception);
    }

    if (exception instanceof Error) {
      return this.handleGenericError(exception);
    }

    return this.handleUnknownException();
  }

  /**
   * NestJS HttpException 처리
   */
  private handleHttpException(exception: HttpException) {
    const status = exception.getStatus();
    const response = exception.getResponse();

    return {
      status,
      message: this.extractMessage(response, exception.message),
      code: this.getErrorCodeByStatus(status),
      error: "HttpException",
      details: this.extractDetails(response),
    };
  }

  /**
   * 일반 Error 처리
   */
  private handleGenericError(exception: Error) {
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      message: "내부 서버 오류가 발생했습니다",
      code: ErrorCode.Infrastructure.INTERNAL_SERVER_ERROR,
      error: exception.constructor.name,
      details: exception.message,
    };
  }

  /**
   * ValidationPipe의 BadRequestException 특별 처리
   */
  private handleValidationException(exception: BadRequestException) {
    const response = exception.getResponse() as any;

    let message: string;
    let details: any = undefined;

    if (Array.isArray(response.message)) {
      // 단일 검증 에러인 경우 구체적인 메시지 사용
      if (response.message.length === 1) {
        message = response.message[0];
      } else {
        message = "입력값 검증에 실패했습니다";
        details = response.message;
      }
    } else {
      message = response.message || exception.message;
    }

    return {
      status: HttpStatus.BAD_REQUEST,
      message,
      code: ErrorCode.Validation.VALIDATION_ERROR,
      error: "ValidationError",
      details,
    };
  }

  /**
   * 알 수 없는 예외 처리
   */
  private handleUnknownException() {
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      message: "알 수 없는 오류가 발생했습니다",
      code: ErrorCode.Infrastructure.INTERNAL_SERVER_ERROR,
      error: "UnknownException",
      details: undefined,
    };
  }

  /**
   * HttpException 응답에서 메시지 추출
   * ValidationPipe의 배열 메시지를 적절히 처리
   */
  private extractMessage(response: any, fallback: string): string {
    if (typeof response === "object" && response?.message) {
      if (Array.isArray(response.message)) {
        // 단일 검증 에러인 경우 구체적인 메시지 사용
        return response.message.length === 1
          ? response.message[0]
          : "입력값 검증에 실패했습니다";
      }
      return response.message;
    }
    return fallback;
  }

  /**
   * HttpException 응답에서 상세 정보 추출
   * 다중 검증 에러인 경우에만 details 배열 반환
   */
  private extractDetails(response: any): any {
    return typeof response === "object" &&
      Array.isArray(response?.message) &&
      response.message.length > 1
      ? response.message
      : undefined;
  }

  /**
   * HTTP 상태 코드에 따른 에러 코드 매핑
   */
  private getErrorCodeByStatus(status: number): string {
    const statusCodeMap: Record<number, string> = {
      400: ErrorCode.Validation.BAD_REQUEST,
      401: ErrorCode.Auth.UNAUTHORIZED,
      403: ErrorCode.Auth.FORBIDDEN,
      404: ErrorCode.Http.NOT_FOUND,
      409: ErrorCode.Http.CONFLICT,
      422: ErrorCode.Http.UNPROCESSABLE_ENTITY,
      500: ErrorCode.Infrastructure.INTERNAL_SERVER_ERROR,
      503: ErrorCode.Infrastructure.SERVICE_UNAVAILABLE,
    };

    return (
      statusCodeMap[status] || ErrorCode.Infrastructure.INTERNAL_SERVER_ERROR
    );
  }
}
