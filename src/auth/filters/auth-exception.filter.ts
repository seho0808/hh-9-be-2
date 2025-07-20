import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpStatus,
  ConflictException,
  UnauthorizedException,
} from "@nestjs/common";
import { Response } from "express";
import { ApiResponseDto } from "@/common/dto/response.dto";

@Catch(ConflictException, UnauthorizedException)
export class AuthExceptionFilter implements ExceptionFilter {
  catch(
    exception: ConflictException | UnauthorizedException,
    host: ArgumentsHost
  ) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status: HttpStatus;
    let errorCode: string;

    switch (exception.constructor) {
      case ConflictException:
        status = HttpStatus.CONFLICT;
        errorCode = "EMAIL_ALREADY_EXISTS";
        break;
      case UnauthorizedException:
        status = HttpStatus.UNAUTHORIZED;
        errorCode = "INVALID_CREDENTIALS";
        break;
      default:
        status = HttpStatus.INTERNAL_SERVER_ERROR;
        errorCode = "INTERNAL_ERROR";
    }

    const errorResponse = ApiResponseDto.error(exception.message, errorCode);

    response.status(status).json(errorResponse);
  }
}
