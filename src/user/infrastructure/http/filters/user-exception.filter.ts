import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpStatus,
} from "@nestjs/common";
import { Response } from "express";
import {
  UserDomainError,
  EmailDuplicateError,
  InvalidEmailFormatError,
  InvalidUserNameError,
  UserNotFoundError,
  RepositoryError,
} from "@/user/domain/exceptions/user.exceptions";

@Catch(UserDomainError)
export class UserExceptionFilter implements ExceptionFilter {
  catch(exception: UserDomainError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const { status, message } = this.mapUserErrorToHttp(exception);

    response.status(status).json({
      statusCode: status,
      message: message,
      error: exception.constructor.name,
      code: exception.code,
      timestamp: new Date().toISOString(),
    });
  }

  private mapUserErrorToHttp(exception: UserDomainError): {
    status: HttpStatus;
    message: string;
  } {
    // User 도메인 예외 → HTTP 상태 코드 매핑
    switch (exception.constructor) {
      case EmailDuplicateError:
        return {
          status: HttpStatus.CONFLICT,
          message: "이미 사용 중인 이메일입니다.",
        };

      case InvalidEmailFormatError:
        return {
          status: HttpStatus.BAD_REQUEST,
          message: "유효하지 않은 이메일 형식입니다.",
        };

      case InvalidUserNameError:
        return {
          status: HttpStatus.BAD_REQUEST,
          message: "유효하지 않은 사용자 이름입니다.",
        };

      case UserNotFoundError:
        return {
          status: HttpStatus.NOT_FOUND,
          message: "사용자를 찾을 수 없습니다.",
        };

      case RepositoryError:
        return {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          message: "데이터 처리 중 오류가 발생했습니다.",
        };

      default:
        return {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          message: "사용자 처리 중 알 수 없는 오류가 발생했습니다.",
        };
    }
  }
}
