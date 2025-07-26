import { Catch, HttpStatus } from "@nestjs/common";
import {
  ProductDomainError,
  ProductNotFoundError,
  InsufficientStockError,
  InactiveProductError,
  InvalidQuantityError,
  StockReservationNotFoundError,
  StockReservationNotActiveError,
  StockReservationExpiredError,
} from "@/product/domain/exceptions/product.exceptions";
import { ErrorCode } from "@/common/types/error-codes.enum";
import {
  BaseExceptionFilter,
  ErrorMapping,
} from "@/common/filters/base-exception.filter";

/**
 * 상품 도메인 예외 처리 필터
 * - 상품 및 재고 관련 모든 예외를 HTTP 응답으로 변환
 * - 각 예외별로 적절한 상태 코드와 메시지 제공
 */
@Catch(ProductDomainError)
export class ProductExceptionFilter extends BaseExceptionFilter<ProductDomainError> {
  /**
   * 상품 도메인 예외를 HTTP 응답으로 매핑
   */
  protected mapErrorToResponse(exception: ProductDomainError): ErrorMapping {
    switch (exception.constructor) {
      case ProductNotFoundError:
        return {
          status: HttpStatus.NOT_FOUND,
          message: "상품을 찾을 수 없습니다",
          errorCode: ErrorCode.Product.Domain.NOT_FOUND,
        };

      case InsufficientStockError:
        return {
          status: HttpStatus.BAD_REQUEST,
          message: "재고가 부족합니다",
          errorCode: ErrorCode.Product.Domain.INSUFFICIENT_STOCK,
        };

      case InvalidQuantityError:
        return {
          status: HttpStatus.BAD_REQUEST,
          message: "유효하지 않은 수량입니다",
          errorCode: ErrorCode.Product.Domain.INVALID_QUANTITY,
        };

      case InactiveProductError:
        return {
          status: HttpStatus.BAD_REQUEST,
          message: "비활성화된 상품입니다",
          errorCode: ErrorCode.Product.Domain.INACTIVE_PRODUCT,
        };

      case StockReservationNotFoundError:
        return {
          status: HttpStatus.NOT_FOUND,
          message: "예약된 재고를 찾을 수 없습니다",
          errorCode: ErrorCode.Product.Domain.STOCK_RESERVATION_NOT_FOUND,
        };

      case StockReservationNotActiveError:
        return {
          status: HttpStatus.BAD_REQUEST,
          message: "재고 예약이 비활성화되었습니다",
          errorCode: ErrorCode.Product.Domain.STOCK_RESERVATION_NOT_ACTIVE,
        };

      case StockReservationExpiredError:
        return {
          status: HttpStatus.BAD_REQUEST,
          message: "재고 예약이 만료되었습니다",
          errorCode: ErrorCode.Product.Domain.STOCK_RESERVATION_EXPIRED,
        };

      default:
        return {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          message: "상품 처리 중 알 수 없는 오류가 발생했습니다",
          errorCode: ErrorCode.Infrastructure.INTERNAL_SERVER_ERROR,
        };
    }
  }
}
