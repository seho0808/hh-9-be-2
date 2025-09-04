import { ApiProperty } from "@nestjs/swagger";
import { IsString, IsOptional, IsEnum, Min, Max } from "class-validator";
import { Coupon } from "@/coupon/domain/entities/coupon.entity";
import { UserCoupon } from "@/coupon/domain/entities/user-coupon.entity";
import { CouponReservation } from "@/coupon/domain/entities/coupon-reservation.entity";

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
  @ApiProperty({
    description: "쿠폰 ID",
    example: "coupon-123",
  })
  id: string;

  @ApiProperty({
    description: "쿠폰명",
    example: "신규가입 10% 할인",
  })
  name: string;

  @ApiProperty({
    description: "할인 타입",
    enum: CouponDiscountType,
    example: CouponDiscountType.PERCENTAGE,
  })
  type: CouponDiscountType;

  @ApiProperty({
    description: "할인값 (% 또는 고정금액)",
    example: 10,
  })
  discountValue: number;

  @ApiProperty({
    description: "최대 할인 금액 (원)",
    nullable: true,
    example: 50000,
  })
  maxDiscount?: number;

  @ApiProperty({
    description: "최소 주문 금액 (원)",
    example: 100000,
  })
  minOrderAmount: number;

  @ApiProperty({
    description: "총 발급 수량",
    example: 1000,
  })
  totalQuantity: number;

  @ApiProperty({
    description: "사용된 수량",
    example: 150,
  })
  usedQuantity: number;

  @ApiProperty({
    description: "남은 수량",
    example: 850,
  })
  remainingQuantity: number;

  @ApiProperty({
    description: "유효 시작일",
    example: "2024-01-01T00:00:00.000Z",
  })
  validFrom: Date;

  @ApiProperty({
    description: "유효 종료일",
    example: "2024-12-31T23:59:59.000Z",
  })
  validTo: Date;

  static fromEntity(coupon: Coupon): CouponResponseDto {
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
  @ApiProperty({
    description: "사용자 쿠폰 ID",
    example: "user-coupon-123",
  })
  id: string;

  @ApiProperty({
    description: "사용자 ID",
    example: "user-123",
  })
  userId: string;

  @ApiProperty({
    description: "쿠폰 정보",
  })
  coupon: CouponResponseDto;

  @ApiProperty({
    description: "쿠폰 상태",
    enum: CouponStatus,
    example: CouponStatus.ACTIVE,
  })
  status: CouponStatus;

  @ApiProperty({
    description: "사용 가능 여부",
    example: true,
  })
  canUse: boolean;

  @ApiProperty({
    description: "발급일시",
    example: "2024-01-15T10:30:00.000Z",
  })
  issuedAt: Date;

  @ApiProperty({
    description: "사용일시",
    nullable: true,
    example: "2024-01-20T14:30:00.000Z",
  })
  usedAt?: Date;

  static fromEntity(userCoupon: UserCoupon): UserCouponResponseDto {
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
      canUse: userCoupon.canUse(),
      issuedAt: userCoupon.createdAt,
      usedAt: userCoupon.usedAt,
    };
  }
}

export class IssueCouponReservationDto {
  @ApiProperty({
    description: "쿠폰 ID",
    example: "coupon-123",
  })
  couponId: string;

  @ApiProperty({
    description: "쿠폰 코드",
    example: "WELCOME2024",
  })
  @IsString()
  couponCode: string;

  @ApiProperty({
    description: "중복 요청 방지 ID",
    example: "claim_user123_20240115_001",
  })
  @IsString()
  idempotencyKey: string;
}

export class IssueCouponReservationResponseDto {
  @ApiProperty({
    description: "쿠폰 ID",
    example: "coupon-123",
  })
  couponId: string;

  @ApiProperty({
    description: "중복 요청 방지 ID",
    example: "claim_user123_20240115_001",
  })
  idempotencyKey: string;

  @ApiProperty({
    description: "쿠폰 발급 예약 ID",
    example: "reservation-123",
  })
  reservationId: string;

  static fromEntity(
    couponReservation: CouponReservation
  ): IssueCouponReservationResponseDto {
    return {
      couponId: couponReservation.couponId,
      idempotencyKey: couponReservation.idempotencyKey,
      reservationId: couponReservation.id,
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
    example: "claim_user123_20240115_001",
    required: false,
  })
  @IsString()
  @IsOptional()
  idempotencyKey?: string;
}

export class DiscountCalculationDto {
  @ApiProperty({
    description: "할인 전 금액 (원)",
    example: 300000,
  })
  originalAmount: number;

  @ApiProperty({
    description: "할인 금액 (원)",
    example: 30000,
  })
  discountAmount: number;

  @ApiProperty({
    description: "할인 후 최종 금액 (원)",
    example: 270000,
  })
  finalAmount: number;

  @ApiProperty({
    description: "적용된 쿠폰 정보",
  })
  appliedCoupon: CouponResponseDto;
}
