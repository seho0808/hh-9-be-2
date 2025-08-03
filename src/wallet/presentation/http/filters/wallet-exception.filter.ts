import { Catch, HttpStatus } from "@nestjs/common";
import {
  PointDomainError,
  InsufficientPointBalanceError,
  InvalidChargeAmountError,
  InvalidUseAmountError,
} from "@/wallet/domain/exceptions/point.exceptions";
import { ErrorCode } from "@/common/constants/error-codes.enum";
import {
  BaseExceptionFilter,
  ErrorMapping,
} from "@/common/filters/base-exception.filter";
import {
  UserBalanceNotFoundError,
  PointTransactionNotFoundError,
  WalletApplicationError,
} from "@/wallet/application/wallet.application.exceptions";
import { PointTransactionAlreadyRecoveredError } from "@/wallet/domain/exceptions/point.exceptions";

/**
 * 지갑 도메인 예외 처리 필터
 * - 포인트/지갑 관련 도메인 예외를 HTTP 응답으로 변환
 * - ValidationPipe 예외는 GlobalExceptionFilter에서 처리
 */
@Catch(PointDomainError, WalletApplicationError)
export class WalletExceptionFilter extends BaseExceptionFilter<
  PointDomainError | WalletApplicationError
> {
  /**
   * 포인트 도메인 예외를 HTTP 응답으로 매핑
   */
  protected mapErrorToResponse(
    exception: PointDomainError | WalletApplicationError
  ): ErrorMapping {
    switch (exception.constructor) {
      case UserBalanceNotFoundError:
        return {
          status: HttpStatus.NOT_FOUND,
          message: "사용자 잔액을 찾을 수 없습니다",
          errorCode: ErrorCode.Wallet.Application.USER_BALANCE_NOT_FOUND,
        };

      case InsufficientPointBalanceError:
        return {
          status: HttpStatus.BAD_REQUEST,
          message: "잔액이 부족합니다",
          errorCode: ErrorCode.Order.Application.INSUFFICIENT_POINT_BALANCE,
        };

      case InvalidChargeAmountError:
        return {
          status: HttpStatus.BAD_REQUEST,
          message: "유효하지 않은 충전 금액입니다",
          errorCode: ErrorCode.Wallet.Domain.INVALID_CHARGE_AMOUNT,
        };

      case InvalidUseAmountError:
        return {
          status: HttpStatus.BAD_REQUEST,
          message: "유효하지 않은 사용 금액입니다",
          errorCode: ErrorCode.Wallet.Domain.INVALID_USE_AMOUNT,
        };

      case PointTransactionNotFoundError:
        return {
          status: HttpStatus.NOT_FOUND,
          message: "포인트 거래를 찾을 수 없습니다",
          errorCode: ErrorCode.Wallet.Application.POINT_TRANSACTION_NOT_FOUND,
        };

      case PointTransactionAlreadyRecoveredError:
        return {
          status: HttpStatus.BAD_REQUEST,
          message: "이미 복구된 거래입니다",
          errorCode:
            ErrorCode.Wallet.Application.POINT_TRANSACTION_ALREADY_RECOVERED,
        };

      default:
        return {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          message: "포인트 처리 중 알 수 없는 오류가 발생했습니다",
          errorCode: ErrorCode.Infrastructure.INTERNAL_SERVER_ERROR,
        };
    }
  }
}
