import { v4 as uuidv4 } from "uuid";
import {
  UserCouponAlreadyUsedError,
  UserCouponCancelledError,
  UserCouponExpiredError,
} from "../exceptions/user-coupon.exception";

export enum UserCouponStatus {
  ISSUED = "ISSUED", // 발급됨
  USED = "USED", // 사용됨
  CANCELLED = "CANCELLED", // 취소됨 (환불 등으로 인해)
}

export interface UserCouponProps {
  id: string;
  couponId: string;
  userId: string;
  orderId: string | null; // 사용 시에만 필요
  discountPrice: number | null; // 실제 할인된 금액 (사용 시에만 필요)
  status: UserCouponStatus;
  expiresAt: Date; // 만료일시
  usedAt: Date | null; // 사용일시 (사용 시에만 설정)
  cancelledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export class UserCoupon {
  private constructor(private readonly props: UserCouponProps) {}

  static create(
    props: Omit<
      UserCouponProps,
      | "id"
      | "status"
      | "usedAt"
      | "cancelledAt"
      | "createdAt"
      | "updatedAt"
      | "orderId"
      | "discountPrice"
    >
  ): UserCoupon {
    const now = new Date();
    return new UserCoupon({
      ...props,
      id: uuidv4(),
      status: UserCouponStatus.ISSUED,
      createdAt: now,
      updatedAt: now,
      orderId: null,
      discountPrice: null,
      usedAt: null,
      cancelledAt: null,
    });
  }

  use(orderId: string, discountPrice: number): void {
    if (this.isExpired()) {
      throw new UserCouponExpiredError(this.props.id);
    }

    if (this.isUsed()) {
      throw new UserCouponAlreadyUsedError(this.props.id);
    }

    if (this.isCancelled()) {
      throw new UserCouponCancelledError(this.props.id);
    }

    this.props.orderId = orderId;
    this.props.discountPrice = discountPrice;
    this.props.status = UserCouponStatus.USED;
    this.props.usedAt = new Date();
    this.props.updatedAt = new Date();
  }

  canUse(): boolean {
    return !this.isExpired() && !this.isUsed() && !this.isCancelled();
  }

  cancel(): void {
    this.props.status = UserCouponStatus.CANCELLED;
    this.props.cancelledAt = new Date();
    this.props.updatedAt = new Date();
  }

  private isExpired(): boolean {
    return this.props.expiresAt < new Date();
  }

  private isUsed(): boolean {
    return this.props.status === UserCouponStatus.USED;
  }

  private isCancelled(): boolean {
    return this.props.status === UserCouponStatus.CANCELLED;
  }

  static fromPersistence(props: UserCouponProps): UserCoupon {
    return new UserCoupon(props);
  }

  toPersistence(): UserCouponProps {
    return { ...this.props };
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

  get orderId(): string | null {
    return this.props.orderId;
  }

  get discountPrice(): number | null {
    return this.props.discountPrice;
  }

  get status(): UserCouponStatus {
    return this.props.status;
  }

  get expiresAt(): Date | null {
    return this.props.expiresAt;
  }

  get usedAt(): Date | null {
    return this.props.usedAt;
  }

  get cancelledAt(): Date | null {
    return this.props.cancelledAt;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }
}
