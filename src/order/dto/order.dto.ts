import { ApiProperty } from "@nestjs/swagger";
import {
  IsString,
  IsNumber,
  IsOptional,
  IsArray,
  ValidateNested,
  Min,
  Max,
} from "class-validator";
import { Type } from "class-transformer";

export enum OrderStatus {
  PENDING = "PENDING",
  SUCCESS = "SUCCESS",
  FAILED = "FAILED",
  CANCELED = "CANCELED",
}

export class OrderItemDto {
  @ApiProperty({
    description: "상품 ID",
    example: "product-1",
  })
  @IsString()
  productId: string;

  @ApiProperty({
    description: "주문 수량",
    example: 2,
    minimum: 1,
    maximum: 10,
  })
  @IsNumber()
  @Type(() => Number)
  @Min(1, { message: "최소 주문 수량은 1개입니다" })
  @Max(10, { message: "상품당 최대 주문 수량은 10개입니다" })
  quantity: number;
}

export class CreateOrderDto {
  @ApiProperty({
    description: "주문 상품 목록",
    type: [OrderItemDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[];

  @ApiProperty({
    description: "사용할 쿠폰 ID",
    required: false,
    example: "coupon-1",
  })
  @IsOptional()
  @IsString()
  couponId?: string;

  @ApiProperty({
    description: "중복 요청 방지 ID",
    required: false,
    example: "order_user123_20240115_001",
  })
  @IsOptional()
  @IsString()
  requestId?: string;
}

export class OrderItemResponseDto {
  @ApiProperty({ description: "주문 항목 ID" })
  id: string;

  @ApiProperty({ description: "상품 ID" })
  productId: string;

  @ApiProperty({ description: "상품명" })
  productName: string;

  @ApiProperty({ description: "주문 수량" })
  quantity: number;

  @ApiProperty({ description: "단가" })
  unitPrice: number;

  @ApiProperty({ description: "항목 총 가격" })
  totalPrice: number;
}

export class OrderResponseDto {
  @ApiProperty({ description: "주문 ID" })
  id: string;

  @ApiProperty({ description: "사용자 ID" })
  userId: string;

  @ApiProperty({ description: "주문 상품 목록" })
  items: OrderItemResponseDto[];

  @ApiProperty({ description: "총 주문 금액" })
  totalAmount: number;

  @ApiProperty({ description: "할인 금액" })
  discountAmount: number;

  @ApiProperty({ description: "최종 결제 금액" })
  finalAmount: number;

  @ApiProperty({
    description: "주문 상태",
    enum: OrderStatus,
  })
  status: OrderStatus;

  @ApiProperty({ description: "사용된 쿠폰 ID", nullable: true })
  usedCouponId?: string;

  @ApiProperty({ description: "사용된 쿠폰명", nullable: true })
  usedCouponName?: string;

  @ApiProperty({ description: "중복 요청 방지 ID" })
  requestId: string;

  @ApiProperty({ description: "주문 생성일시" })
  createdAt: Date;

  @ApiProperty({ description: "주문 수정일시" })
  updatedAt: Date;
}

export class OrderQueryDto {
  @ApiProperty({
    description: "주문 상태 필터",
    enum: OrderStatus,
    required: false,
  })
  @IsOptional()
  status?: OrderStatus;

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

export class OrderSummaryDto {
  @ApiProperty({ description: "총 주문 금액" })
  totalAmount: number;

  @ApiProperty({ description: "할인 금액" })
  discountAmount: number;

  @ApiProperty({ description: "최종 결제 금액" })
  finalAmount: number;

  @ApiProperty({ description: "사용 가능한 잔액" })
  availableBalance: number;

  @ApiProperty({ description: "잔액 부족 여부" })
  isInsufficientBalance: boolean;

  @ApiProperty({ description: "적용된 쿠폰 정보", nullable: true })
  appliedCoupon?: {
    id: string;
    name: string;
    discountAmount: number;
  };
}
