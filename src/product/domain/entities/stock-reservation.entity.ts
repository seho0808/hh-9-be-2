import { v4 as uuidv4 } from "uuid";
import {
  StockReservationConfirmStockOrderIdMismatchError,
  StockReservationReleaseOrderIdMismatchError,
} from "../exceptions/product.exceptions";

export enum StockReservationStatus {
  RESERVED = "RESERVED",
  CONFIRMED = "CONFIRMED",
  RELEASED = "RELEASED",
}

export interface StockReservationProps {
  id: string;
  productId: string;
  userId: string;
  quantity: number;
  orderId: string;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date;
  status: StockReservationStatus;
}

export class StockReservation {
  private static readonly EXPIRATION_TIME = 1000 * 30; // 30 seconds
  constructor(private readonly props: StockReservationProps) {}

  static create(
    props: Omit<
      StockReservationProps,
      "id" | "createdAt" | "updatedAt" | "expiresAt" | "status"
    >
  ): StockReservation {
    const now = new Date();
    return new StockReservation({
      ...props,
      id: uuidv4(),
      status: StockReservationStatus.RESERVED,
      expiresAt: new Date(now.getTime() + StockReservation.EXPIRATION_TIME),
      createdAt: now,
      updatedAt: now,
    });
  }

  releaseStock(orderId: string): void {
    if (this.props.orderId !== orderId) {
      throw new StockReservationReleaseOrderIdMismatchError(
        this.props.id,
        orderId
      );
    }
    this.props.status = StockReservationStatus.RELEASED;
    this.props.updatedAt = new Date();
  }

  confirmStock(orderId: string): void {
    if (this.props.orderId !== orderId) {
      throw new StockReservationConfirmStockOrderIdMismatchError(
        this.props.id,
        orderId
      );
    }
    this.props.status = StockReservationStatus.CONFIRMED;
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

  get orderId(): string {
    return this.props.orderId;
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

  get status(): StockReservationStatus {
    return this.props.status;
  }
}
