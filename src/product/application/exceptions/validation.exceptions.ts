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
