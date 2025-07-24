import { ExceptionFilter, ArgumentsHost, HttpStatus } from "@nestjs/common";
import { Response, Request } from "express";
import { StandardErrorResponseDto } from "@/common/dto/standard-error-response.dto";

/**
 * 예외 매핑 정보
 */
export interface ErrorMapping {
  status: HttpStatus;
  message: string;
  errorCode: string;
}

/**
 * 예외 필터 베이스 클래스
 * - 공통 로직을 추상화하여 코드 중복 제거
 * - 선언적인 에러 매핑으로 가독성 향상
 */
export abstract class BaseExceptionFilter<T extends Error>
  implements ExceptionFilter
{
  /**
   * 예외를 ErrorMapping으로 변환하는 추상 메서드
   */
  protected abstract mapErrorToResponse(exception: T): ErrorMapping;

  catch(exception: T, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const errorMapping = this.mapErrorToResponse(exception);

    const errorResponse = new StandardErrorResponseDto(
      errorMapping.status,
      errorMapping.message,
      errorMapping.errorCode,
      exception.constructor.name
    );

    response.status(errorMapping.status).json(errorResponse);
  }
}
