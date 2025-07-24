export abstract class OrderDomainError extends Error {
  abstract readonly code: string;

  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class OrderNotFoundError extends OrderDomainError {
  readonly code = "ORDER_NOT_FOUND";

  constructor(orderId: string) {
    super(`주문을 찾을 수 없습니다. ID: ${orderId}`);
  }
}
