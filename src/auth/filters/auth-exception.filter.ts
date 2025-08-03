import {
  Catch,
  HttpStatus,
  ConflictException,
  UnauthorizedException,
} from "@nestjs/common";
import { ErrorCode } from "@/common/types/error-codes.enum";
import {
  BaseExceptionFilter,
  ErrorMapping,
} from "@/common/filters/base-exception.filter";

type AuthException = ConflictException | UnauthorizedException;

/**
 * 인증 예외 처리 필터
 * - 인증 관련 모든 예외를 HTTP 응답으로 변환
 * - ConflictException, UnauthorizedException 처리
 */
@Catch(ConflictException, UnauthorizedException)
export class AuthExceptionFilter extends BaseExceptionFilter<AuthException> {
  /**
   * 인증 예외를 HTTP 응답으로 매핑
   */
  protected mapErrorToResponse(exception: AuthException): ErrorMapping {
    switch (exception.constructor) {
      case ConflictException:
        return {
          status: HttpStatus.CONFLICT,
          message: "이미 사용 중인 이메일입니다",
          errorCode: ErrorCode.Auth.EMAIL_ALREADY_EXISTS,
        };

      case UnauthorizedException:
        return {
          status: HttpStatus.UNAUTHORIZED,
          message: "이메일 또는 비밀번호가 올바르지 않습니다",
          errorCode: ErrorCode.Auth.INVALID_CREDENTIALS,
        };

      default:
        return {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          message: "인증 처리 중 알 수 없는 오류가 발생했습니다",
          errorCode: ErrorCode.Infrastructure.INTERNAL_SERVER_ERROR,
        };
    }
  }
}
