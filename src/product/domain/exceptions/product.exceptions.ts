export abstract class ProductDomainError extends Error {
  abstract readonly code: string;

  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class ProductNotFoundError extends ProductDomainError {
  readonly code = "PRODUCT_NOT_FOUND";

  constructor(productId: string) {
    super(`상품을 찾을 수 없습니다. ID: ${productId}`);
  }
}

export class InsufficientStockError extends ProductDomainError {
  readonly code = "INSUFFICIENT_STOCK";

  constructor(
    productId: string,
    availableStock: number,
    requestedAmount: number
  ) {
    super(
      `재고가 부족합니다. 상품ID: ${productId}, 사용가능: ${availableStock}, 요청: ${requestedAmount}`
    );
  }
}

export class InvalidQuantityError extends ProductDomainError {
  readonly code = "INVALID_QUANTITY";

  constructor(quantity: number) {
    super(`유효하지 않은 수량입니다: ${quantity}`);
  }
}

export class InactiveProductError extends ProductDomainError {
  readonly code = "INACTIVE_PRODUCT";

  constructor(productId: string) {
    super(`비활성화된 상품입니다. ID: ${productId}`);
  }
}

export class StockReservationNotFoundError extends ProductDomainError {
  readonly code = "STOCK_RESERVATION_NOT_FOUND";

  constructor(stockReservationId: string) {
    super(`예약된 재고가 없습니다. ID: ${stockReservationId}`);
  }
}

export class StockReservationNotActiveError extends ProductDomainError {
  readonly code = "STOCK_RESERVATION_NOT_ACTIVE";

  constructor(stockReservationId: string) {
    super(`재고 예약이 비활성화되었습니다. ID: ${stockReservationId}`);
  }
}

export class StockReservationExpiredError extends ProductDomainError {
  readonly code = "STOCK_RESERVATION_EXPIRED";

  constructor(stockReservationId: string) {
    super(`재고 예약이 만료되었습니다. ID: ${stockReservationId}`);
  }
}

export class StockReservationReleaseIdempotencyKeyMismatchError extends ProductDomainError {
  readonly code = "STOCK_RESERVATION_RELEASE_IDEMPOTENCY_KEY_MISMATCH";

  constructor(stockReservationId: string, idempotencyKey: string) {
    super(
      `재고 예약 취소를 위한 멱등성 키가 일치하지 않습니다. ID: ${stockReservationId}, 키: ${idempotencyKey}`
    );
  }
}

export class StockReservationConfirmStockIdempotencyKeyMismatchError extends ProductDomainError {
  readonly code = "STOCK_RESERVATION_CONFIRM_STOCK_IDEMPOTENCY_KEY_MISMATCH";

  constructor(stockReservationId: string, idempotencyKey: string) {
    super(
      `재고 예약 확정을 위한 멱등성 키가 일치하지 않습니다. ID: ${stockReservationId}, 키: ${idempotencyKey}`
    );
  }
}
