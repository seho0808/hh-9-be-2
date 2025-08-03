import { ValidationError } from "class-validator";

export abstract class ProductApplicationError extends Error {
  abstract readonly code: string;

  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class ProductValidationException extends ProductApplicationError {
  readonly code = "PRODUCT_VALIDATION_ERROR";

  constructor(errors: ValidationError[]) {
    super(errors.map((error) => error.toString()).join(", "));
  }
}

export class ProductNotFoundError extends ProductApplicationError {
  readonly code = "PRODUCT_NOT_FOUND";

  constructor(productId: string) {
    super(`상품을 찾을 수 없습니다. ID: ${productId}`);
  }
}

export class StockReservationNotFoundError extends ProductApplicationError {
  readonly code = "STOCK_RESERVATION_NOT_FOUND";

  constructor(stockReservationId: string) {
    super(`재고 예약을 찾을 수 없습니다. ID: ${stockReservationId}`);
  }
}
