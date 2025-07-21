import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpStatus,
} from "@nestjs/common";
import { Response } from "express";
import {
  ProductDomainError,
  ProductNotFoundError,
  InsufficientStockError,
  InactiveProductError,
} from "@/product/domain/exceptions/product.exceptions";

@Catch(ProductDomainError)
export class ProductExceptionFilter implements ExceptionFilter {
  catch(exception: ProductDomainError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const { status, message } = this.mapProductErrorToHttp(exception);

    response.status(status).json({
      statusCode: status,
      message: message,
      error: exception.constructor.name,
      code: exception.code,
      timestamp: new Date().toISOString(),
    });
  }

  private mapProductErrorToHttp(exception: ProductDomainError): {
    status: HttpStatus;
    message: string;
  } {
    switch (exception.constructor) {
      case ProductNotFoundError:
        return {
          status: HttpStatus.NOT_FOUND,
          message: "상품을 찾을 수 없습니다.",
        };

      case InsufficientStockError:
        return {
          status: HttpStatus.BAD_REQUEST,
          message: "재고가 부족합니다.",
        };

      case InactiveProductError:
        return {
          status: HttpStatus.BAD_REQUEST,
          message: "비활성화된 상품입니다.",
        };

      default:
        return {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          message: "상품 처리 중 알 수 없는 오류가 발생했습니다.",
        };
    }
  }
}
