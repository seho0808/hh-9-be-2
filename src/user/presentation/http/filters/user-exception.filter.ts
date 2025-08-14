import { Catch, HttpStatus } from "@nestjs/common";
import {
  UserDomainError,
  EmailDuplicateError,
  InvalidEmailFormatError,
  InvalidUserNameError,
} from "@/user/domain/exceptions/user.exceptions";
import { ErrorCode } from "@/common/constants/error-codes.enum";
import {
  BaseExceptionFilter,
  ErrorMapping,
} from "@/common/presentation/filters/base-exception.filter";
import {
  UserApplicationError,
  UserNotFoundError,
} from "@/user/application/user.application.exceptions";

/**
 * 사용자 도메인 및 애플리케이션 예외 처리 필터
 * - 사용자 관련 모든 예외를 HTTP 응답으로 변환
 * - 각 예외별로 적절한 상태 코드와 메시지 제공
 */
@Catch(UserDomainError, UserApplicationError)
export class UserExceptionFilter extends BaseExceptionFilter<
  UserDomainError | UserApplicationError
> {
  /**
   * 사용자 도메인 및 애플리케이션 예외를 HTTP 응답으로 매핑
   */
  protected mapErrorToResponse(
    exception: UserDomainError | UserApplicationError
  ): ErrorMapping {
    switch (exception.constructor) {
      case EmailDuplicateError:
        return {
          status: HttpStatus.CONFLICT,
          message: "이미 사용 중인 이메일입니다",
          errorCode: ErrorCode.User.Domain.EMAIL_DUPLICATE,
        };

      case InvalidEmailFormatError:
        return {
          status: HttpStatus.BAD_REQUEST,
          message: "유효하지 않은 이메일 형식입니다",
          errorCode: ErrorCode.User.Domain.INVALID_EMAIL_FORMAT,
        };

      case InvalidUserNameError:
        return {
          status: HttpStatus.BAD_REQUEST,
          message: "유효하지 않은 사용자 이름입니다",
          errorCode: ErrorCode.User.Domain.INVALID_USER_NAME,
        };

      case UserNotFoundError:
        return {
          status: HttpStatus.NOT_FOUND,
          message: "사용자를 찾을 수 없습니다",
          errorCode: ErrorCode.User.Application.NOT_FOUND,
        };

      default:
        return {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          message: "사용자 처리 중 알 수 없는 오류가 발생했습니다",
          errorCode: ErrorCode.Infrastructure.INTERNAL_SERVER_ERROR,
        };
    }
  }
}
