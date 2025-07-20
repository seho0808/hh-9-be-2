import { ApiProperty } from "@nestjs/swagger";
import { IsString, IsOptional, IsEnum, Min, Max } from "class-validator";
import { Type } from "class-transformer";

export enum CouponType {
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

  @ApiProperty({ description: "쿠폰 코드" })
  code: string;

  @ApiProperty({ description: "쿠폰명" })
  name: string;

  @ApiProperty({
    description: "할인 타입",
    enum: CouponType,
  })
  type: CouponType;

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

  @ApiProperty({ description: "활성화 상태" })
  isActive: boolean;

  @ApiProperty({ description: "발급 가능 여부" })
  canIssue: boolean;
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
}

export class ClaimCouponDto {
  @ApiProperty({
    description: "쿠폰 코드",
    example: "WELCOME2024",
  })
  @IsString()
  couponCode: string;
}

export class CouponQueryDto {
  @ApiProperty({
    description: "쿠폰 타입 필터",
    enum: CouponType,
    required: false,
  })
  @IsOptional()
  @IsEnum(CouponType)
  type?: CouponType;

  @ApiProperty({
    description: "활성화 상태 필터",
    required: false,
    default: true,
  })
  @IsOptional()
  isActive?: boolean;

  @ApiProperty({
    description: "페이지 번호",
    required: false,
    default: 1,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  page?: number = 1;

  @ApiProperty({
    description: "페이지당 항목 수",
    required: false,
    default: 10,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(100)
  limit?: number = 10;
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
