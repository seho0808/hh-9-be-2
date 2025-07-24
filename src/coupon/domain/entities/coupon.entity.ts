import { v4 as uuidv4 } from "uuid";
import {
  CannotCancelExhaustedCouponError,
  CouponExhaustedError,
  CouponExpiredError,
  InsufficientOrderPriceError,
  InvalidCouponCodeError,
  InvalidCouponDateRangeError,
  InvalidCouponDiscountError,
} from "../exceptions/coupon.exceptions";

export enum CouponDiscountType {
  FIXED = "FIXED", // 고정 금액 할인
  PERCENTAGE = "PERCENTAGE", // 퍼센트 할인
}

export interface CouponProps {
  id: string;
  name: string;
  description: string;
  couponCode: string;
  discountType: CouponDiscountType;
  discountValue: number; // 고정 금액이면 원 단위, 퍼센트면 0-100
  minimumOrderPrice: number; // 최소 주문 금액
  maxDiscountPrice: number | null; // 최대 할인 금액 (퍼센트 할인 시 사용)
  issuedCount: number; // 발급된 수량
  usedCount: number; // 사용된 수량
  totalCount: number; // 전체 발급 가능 수량
  startDate: Date; // 발급 가능 시작일
  endDate: Date; // 발급 가능 종료일
  expiresInDays: number; // 사용 가능 기간 (일)
  createdAt: Date;
  updatedAt: Date;
}

export class Coupon {
  private constructor(private readonly props: CouponProps) {}

  static create(
    props: Omit<
      CouponProps,
      "id" | "issuedCount" | "usedCount" | "createdAt" | "updatedAt"
    >
  ): Coupon {
    if (!this.isValidDiscountValue(props.discountType, props.discountValue)) {
      throw new InvalidCouponDiscountError(
        props.discountType,
        props.discountValue
      );
    }

    if (!this.isValidDateRange(props.startDate, props.endDate)) {
      throw new InvalidCouponDateRangeError(props.startDate, props.endDate);
    }

    const now = new Date();
    return new Coupon({
      ...props,
      id: uuidv4(),
      issuedCount: 0,
      usedCount: 0,
      createdAt: now,
      updatedAt: now,
    });
  }

  issue(couponCode: string): void {
    if (this.props.couponCode !== couponCode) {
      throw new InvalidCouponCodeError(couponCode);
    }

    if (this.isExpired()) {
      throw new CouponExpiredError(this.props.id, this.props.endDate);
    }

    if (!this.isStockLeft()) {
      throw new CouponExhaustedError(this.props.id);
    }

    this.props.issuedCount += 1;
    this.props.updatedAt = new Date();
  }

  use(orderPrice: number): { discountPrice: number; discountedPrice: number } {
    if (orderPrice < this.props.minimumOrderPrice) {
      throw new InsufficientOrderPriceError(
        this.props.id,
        this.props.minimumOrderPrice,
        orderPrice
      );
    }

    this.props.usedCount += 1;
    this.props.updatedAt = new Date();

    return {
      discountPrice: this.calculateDiscountPrice(orderPrice),
      discountedPrice: orderPrice - this.calculateDiscountPrice(orderPrice),
    };
  }

  canUse(orderPrice: number): boolean {
    return orderPrice >= this.props.minimumOrderPrice;
  }

  cancel(): void {
    if (this.props.usedCount <= 0) {
      throw new CannotCancelExhaustedCouponError(this.props.id);
    }
    this.props.usedCount -= 1;
    this.props.updatedAt = new Date();
  }

  private calculateDiscountPrice(orderPrice: number): number {
    let discountPrice: number;

    if (this.props.discountType === CouponDiscountType.FIXED) {
      discountPrice = this.props.discountValue;
    } else {
      discountPrice = Math.floor((orderPrice * this.props.discountValue) / 100);

      if (this.props.maxDiscountPrice) {
        discountPrice = Math.min(discountPrice, this.props.maxDiscountPrice);
      }
    }

    return Math.min(discountPrice, orderPrice);
  }

  private isStockLeft(): boolean {
    return this.getRemainingCount() > 0;
  }

  private isExpired(): boolean {
    return new Date() > this.props.endDate;
  }

  private getRemainingCount(): number {
    return this.props.totalCount - this.props.issuedCount;
  }

  static fromPersistence(props: CouponProps): Coupon {
    return new Coupon(props);
  }

  toPersistence(): CouponProps {
    return { ...this.props };
  }

  static isValidDiscountValue(
    type: CouponDiscountType,
    value: number
  ): boolean {
    if (type === CouponDiscountType.FIXED) {
      return value > 0 && value <= 1_000_000; // 최대 100만원
    } else {
      return value > 0 && value <= 100; // 최대 100%
    }
  }

  static isValidDateRange(startDate: Date, endDate: Date): boolean {
    return startDate < endDate;
  }

  get id(): string {
    return this.props.id;
  }

  get name(): string {
    return this.props.name;
  }

  get description(): string {
    return this.props.description;
  }

  get discountType(): CouponDiscountType {
    return this.props.discountType;
  }

  get discountValue(): number {
    return this.props.discountValue;
  }

  get minimumOrderPrice(): number {
    return this.props.minimumOrderPrice;
  }

  get maxDiscountPrice(): number | null {
    return this.props.maxDiscountPrice;
  }

  get issuedCount(): number {
    return this.props.issuedCount;
  }

  get usedCount(): number {
    return this.props.usedCount;
  }

  get totalCount(): number {
    return this.props.totalCount;
  }

  get startDate(): Date {
    return this.props.startDate;
  }

  get endDate(): Date {
    return this.props.endDate;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }
}
