import { v4 as uuidv4 } from "uuid";
import { CouponReservationConfirmStatusNotPendingError } from "../exceptions/user-coupon.exception";

export enum CouponReservationStatus {
  PENDING = "PENDING",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
  TIMEOUT = "TIMEOUT",
}

export interface CouponReservationProps {
  id: string;
  couponId: string;
  userId: string;
  couponCode: string;
  idempotencyKey: string;
  status: CouponReservationStatus;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export class CouponReservation {
  constructor(private readonly props: CouponReservationProps) {}

  static create(
    props: Omit<
      CouponReservationProps,
      "id" | "createdAt" | "updatedAt" | "status" | "expiresAt"
    >
  ): CouponReservation {
    return new CouponReservation({
      ...props,
      id: uuidv4(),
      status: CouponReservationStatus.PENDING,
      expiresAt: new Date(new Date().getTime() + 1000 * 60 * 5),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  changeStatus(status: CouponReservationStatus): void {
    this.props.status = status;
    this.props.updatedAt = new Date();
  }

  confirm(): void {
    if (this.props.status !== CouponReservationStatus.PENDING) {
      throw new CouponReservationConfirmStatusNotPendingError(this.props.id);
    }
    this.props.status = CouponReservationStatus.COMPLETED;
    this.props.updatedAt = new Date();
  }

  isExpired(): boolean {
    if (this.props.expiresAt < new Date()) {
      return true;
    }
    return false;
  }

  get id(): string {
    return this.props.id;
  }

  get couponId(): string {
    return this.props.couponId;
  }

  get userId(): string {
    return this.props.userId;
  }

  get couponCode(): string {
    return this.props.couponCode;
  }

  get idempotencyKey(): string {
    return this.props.idempotencyKey;
  }

  get status(): CouponReservationStatus {
    return this.props.status;
  }

  get expiresAt(): Date {
    return this.props.expiresAt;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }
}
