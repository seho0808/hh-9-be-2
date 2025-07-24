import { ApiProperty } from "@nestjs/swagger";
import { IsString, IsOptional, IsEnum, Min, Max } from "class-validator";
import { Type } from "class-transformer";
import { Coupon } from "@/coupon/domain/entities/coupon.entity";
import { UserCoupon } from "@/coupon/domain/entities/user-coupon.entity";

export enum CouponDiscountType {
  PERCENTAGE = "PERCENTAGE",
  FIXED_AMOUNT = "FIXED_AMOUNT",
}

export enum CouponStatus {
  ACTIVE = "ACTIVE",
  USED = "USED",
  EXPIRED = "EXPIRED",
  CANCELED = "CANCELED",
}

export class CouponResponseDto {
  @ApiProperty({ description: "쿠폰 ID" })
  id: string;

  @ApiProperty({ description: "쿠폰명" })
  name: string;

  @ApiProperty({
    description: "할인 타입",
    enum: CouponDiscountType,
  })
  type: CouponDiscountType;

  @ApiProperty({ description: "할인값 (% 또는 고정금액)" })
  discountValue: number;

  @ApiProperty({ description: "최대 할인 금액", nullable: true })
  maxDiscount?: number;

  @ApiProperty({ description: "최소 주문 금액" })
  minOrderAmount: number;

  @ApiProperty({ description: "총 발급 수량" })
  totalQuantity: number;

  @ApiProperty({ description: "사용된 수량" })
  usedQuantity: number;

  @ApiProperty({ description: "남은 수량" })
  remainingQuantity: number;

  @ApiProperty({ description: "유효 시작일" })
  validFrom: Date;

  @ApiProperty({ description: "유효 종료일" })
  validTo: Date;

  static fromCoupon(coupon: Coupon): CouponResponseDto {
    return {
      id: coupon.id,
      name: coupon.name,
      type:
        coupon.discountType === "FIXED"
          ? CouponDiscountType.FIXED_AMOUNT
          : CouponDiscountType.PERCENTAGE,
      discountValue: coupon.discountValue,
      maxDiscount: coupon.maxDiscountPrice,
      minOrderAmount: coupon.minimumOrderPrice,
      totalQuantity: coupon.totalCount,
      usedQuantity: coupon.usedCount,
      remainingQuantity: coupon.totalCount - coupon.usedCount,
      validFrom: coupon.startDate,
      validTo: coupon.endDate,
    };
  }
}

export class UserCouponResponseDto {
  @ApiProperty({ description: "사용자 쿠폰 ID" })
  id: string;

  @ApiProperty({ description: "사용자 ID" })
  userId: string;

  @ApiProperty({ description: "쿠폰 정보" })
  coupon: CouponResponseDto;

  @ApiProperty({
    description: "쿠폰 상태",
    enum: CouponStatus,
  })
  status: CouponStatus;

  @ApiProperty({ description: "발급일시" })
  issuedAt: Date;

  @ApiProperty({ description: "사용일시", nullable: true })
  usedAt?: Date;

  @ApiProperty({ description: "사용 가능 여부" })
  canUse: boolean;

  static fromUserCoupon(userCoupon: UserCoupon): UserCouponResponseDto {
    return {
      id: userCoupon.id,
      userId: userCoupon.userId,
      coupon: null, // TODO: 쿠폰 정보 추가
      status:
        userCoupon.expiresAt && userCoupon.expiresAt < new Date()
          ? CouponStatus.EXPIRED
          : userCoupon.status === "ISSUED"
            ? CouponStatus.ACTIVE
            : userCoupon.status === "USED"
              ? CouponStatus.USED
              : CouponStatus.CANCELED,
      issuedAt: userCoupon.createdAt,
      usedAt: userCoupon.usedAt,
      canUse: userCoupon.canUse(),
    };
  }
}

export class ClaimCouponDto {
  @ApiProperty({
    description: "쿠폰 코드",
    example: "WELCOME2024",
  })
  @IsString()
  couponCode: string;

  @ApiProperty({
    description: "중복 요청 방지 ID",
    example: "1234567890",
    required: false,
  })
  @IsString()
  @IsOptional()
  idempotencyKey?: string;
}

export class DiscountCalculationDto {
  @ApiProperty({ description: "할인 전 금액" })
  originalAmount: number;

  @ApiProperty({ description: "할인 금액" })
  discountAmount: number;

  @ApiProperty({ description: "할인 후 최종 금액" })
  finalAmount: number;

  @ApiProperty({ description: "적용된 쿠폰 정보" })
  appliedCoupon: CouponResponseDto;
}
