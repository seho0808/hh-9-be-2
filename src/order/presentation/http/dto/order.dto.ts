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
import { Order } from "@/order/domain/entities/order.entitiy";
import { OrderItem } from "@/order/domain/entities/order-item.entity";

export enum OrderStatus {
  PENDING = "PENDING",
  SUCCESS = "SUCCESS",
  FAILED = "FAILED",
  CANCELLED = "CANCELLED",
}

export class OrderItemDto {
  @ApiProperty({
    description: "상품 ID",
    example: "product-123",
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
    example: [
      { productId: "product-123", quantity: 2 },
      { productId: "product-456", quantity: 1 },
    ],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[];

  @ApiProperty({
    description: "사용할 쿠폰 ID",
    required: false,
    example: "coupon-123",
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
  idempotencyKey?: string;
}

export class OrderItemResponseDto {
  @ApiProperty({
    description: "주문 항목 ID",
    example: "order-item-123",
  })
  id: string;

  @ApiProperty({
    description: "상품 ID",
    example: "product-123",
  })
  productId: string;

  @ApiProperty({
    description: "상품명",
    example: "iPhone 15 Pro",
  })
  productName: string;

  @ApiProperty({
    description: "주문 수량",
    example: 2,
  })
  quantity: number;

  @ApiProperty({
    description: "단가 (원)",
    example: 1500000,
  })
  unitPrice: number;

  @ApiProperty({
    description: "항목 총 가격 (원)",
    example: 3000000,
  })
  totalPrice: number;

  static fromEntity(
    orderItem: OrderItem,
    productName?: string
  ): OrderItemResponseDto {
    return {
      id: orderItem.id,
      productId: orderItem.productId,
      productName: productName || orderItem.productId, // For simplicity, use productId if name not provided
      quantity: orderItem.quantity,
      unitPrice: orderItem.unitPrice,
      totalPrice: orderItem.totalPrice,
    };
  }
}

export class OrderResponseDto {
  @ApiProperty({
    description: "주문 ID",
    example: "order-123",
  })
  id: string;

  @ApiProperty({
    description: "사용자 ID",
    example: "user-123",
  })
  userId: string;

  @ApiProperty({
    description: "주문 상품 목록",
  })
  items: OrderItemResponseDto[];

  @ApiProperty({
    description: "총 주문 금액 (원)",
    example: 3000000,
  })
  totalAmount: number;

  @ApiProperty({
    description: "할인 금액 (원)",
    example: 300000,
  })
  discountAmount: number;

  @ApiProperty({
    description: "최종 결제 금액 (원)",
    example: 2700000,
  })
  finalAmount: number;

  @ApiProperty({
    description: "주문 상태",
    enum: OrderStatus,
    example: OrderStatus.SUCCESS,
  })
  status: OrderStatus;

  @ApiProperty({
    description: "사용된 쿠폰 ID",
    nullable: true,
    example: "coupon-123",
  })
  usedCouponId?: string;

  @ApiProperty({
    description: "사용된 쿠폰명",
    nullable: true,
    example: "신규가입 10% 할인",
  })
  usedCouponName?: string;

  @ApiProperty({
    description: "중복 요청 방지 ID",
    example: "order_user123_20240115_001",
  })
  idempotencyKey: string;

  @ApiProperty({
    description: "주문 생성일시",
    example: "2024-01-15T10:30:00.000Z",
  })
  createdAt: Date;

  @ApiProperty({
    description: "주문 수정일시",
    example: "2024-01-15T10:30:00.000Z",
  })
  updatedAt: Date;

  static fromEntity(order: Order): OrderResponseDto {
    return {
      id: order.id,
      userId: order.userId,
      items: order.orderItems.map((item) =>
        OrderItemResponseDto.fromEntity(item)
      ),
      totalAmount: order.totalPrice,
      discountAmount: order.discountPrice,
      finalAmount: order.finalPrice,
      status: order.status as OrderStatus,
      usedCouponId: order.appliedUserCouponId,
      usedCouponName: order.appliedUserCouponId, // For simplicity
      idempotencyKey: order.idempotencyKey,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    };
  }
}
