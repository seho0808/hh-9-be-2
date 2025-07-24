import { v4 as uuidv4 } from "uuid";
import { OrderItem } from "./order-item.entity";

export enum OrderStatus {
  PENDING = "PENDING",
  SUCCESS = "SUCCESS",
  FAILED = "FAILED",
  CANCELLED = "CANCELLED",
}

export interface OrderProps {
  id: string;
  userId: string;
  totalPrice: number;
  discountPrice: number;
  finalPrice: number;
  status: OrderStatus;
  failedReason: string | null;
  idempotencyKey: string;
  appliedCouponId: string | null;
  createdAt: Date;
  updatedAt: Date;
  OrderItems: OrderItem[];
}

export class Order {
  constructor(private readonly props: OrderProps) {}

  static create(
    props: Omit<
      OrderProps,
      | "id"
      | "failedReason"
      | "appliedCouponId"
      | "createdAt"
      | "updatedAt"
      | "OrderItems"
    >
  ): Order {
    const now = new Date();
    return new Order({
      ...props,
      id: uuidv4(),
      failedReason: null,
      appliedCouponId: null,
      createdAt: now,
      updatedAt: now,
      OrderItems: [],
    });
  }

  static fromPersistence(props: OrderProps): Order {
    return new Order(props);
  }

  toPersistence(): OrderProps {
    return this.props;
  }

  changeStatus(status: OrderStatus): void {
    this.props.status = status;
    this.props.updatedAt = new Date();
  }

  setFailedReason(reason: string): void {
    this.props.failedReason = reason;
    this.props.updatedAt = new Date();
  }

  initOrderItems(orderItems: OrderItem[]): void {
    this.props.OrderItems.push(...orderItems);
    this.props.totalPrice = orderItems.reduce(
      (acc, item) => acc + item.totalPrice,
      0
    );
    this.props.finalPrice = this.props.totalPrice;
    this.props.updatedAt = new Date();
  }

  applyDiscount({
    appliedCouponId,
    discountPrice,
    discountedPrice,
  }: {
    appliedCouponId: string;
    discountPrice: number;
    discountedPrice: number;
  }): void {
    this.props.appliedCouponId = appliedCouponId;
    this.props.discountPrice = discountPrice;
    this.props.finalPrice = discountedPrice;
    this.props.updatedAt = new Date();
  }

  get id(): string {
    return this.props.id;
  }

  get userId(): string {
    return this.props.userId;
  }

  get totalPrice(): number {
    return this.props.totalPrice;
  }

  get discountPrice(): number {
    return this.props.discountPrice;
  }

  get finalPrice(): number {
    return this.props.finalPrice;
  }

  get status(): OrderStatus {
    return this.props.status;
  }

  get idempotencyKey(): string {
    return this.props.idempotencyKey;
  }

  get appliedCouponId(): string | null {
    return this.props.appliedCouponId;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }
}
