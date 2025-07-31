import { v4 as uuidv4 } from "uuid";
import {
  StockReservationConfirmStockIdempotencyKeyMismatchError,
  StockReservationReleaseIdempotencyKeyMismatchError,
} from "../exceptions/product.exceptions";

export interface StockReservationProps {
  id: string;
  productId: string;
  userId: string;
  quantity: number;
  idempotencyKey: string;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date;
  isActive: boolean;
}

export class StockReservation {
  private static readonly EXPIRATION_TIME = 1000 * 30; // 30 seconds
  constructor(private readonly props: StockReservationProps) {}

  static create(
    props: Omit<
      StockReservationProps,
      "id" | "createdAt" | "updatedAt" | "expiresAt" | "isActive"
    >
  ): StockReservation {
    const now = new Date();
    return new StockReservation({
      ...props,
      id: uuidv4(),
      isActive: true,
      expiresAt: new Date(now.getTime() + StockReservation.EXPIRATION_TIME),
      createdAt: now,
      updatedAt: now,
    });
  }

  releaseStock(idempotencyKey: string): void {
    if (this.props.idempotencyKey !== idempotencyKey) {
      throw new StockReservationReleaseIdempotencyKeyMismatchError(
        this.props.id,
        idempotencyKey
      );
    }
    this.props.isActive = false;
    this.props.updatedAt = new Date();
  }

  confirmStock(idempotencyKey: string): void {
    if (this.props.idempotencyKey !== idempotencyKey) {
      throw new StockReservationConfirmStockIdempotencyKeyMismatchError(
        this.props.id,
        idempotencyKey
      );
    }
    this.props.isActive = false;
    this.props.updatedAt = new Date();
  }

  get id(): string {
    return this.props.id;
  }

  get productId(): string {
    return this.props.productId;
  }

  get userId(): string {
    return this.props.userId;
  }

  get quantity(): number {
    return this.props.quantity;
  }

  get idempotencyKey(): string {
    return this.props.idempotencyKey;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  get expiresAt(): Date {
    return this.props.expiresAt;
  }

  get isActive(): boolean {
    return this.props.isActive;
  }
}
