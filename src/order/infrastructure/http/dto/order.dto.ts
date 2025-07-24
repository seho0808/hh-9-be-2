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
  idempotencyKey?: string;
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

  static fromOrderItem(
    orderItem: OrderItem,
    productName?: string
  ): OrderItemResponseDto {
    const props = orderItem.toPersistence();
    return {
      id: props.id,
      productId: props.productId,
      productName: productName || props.productId, // For simplicity, use productId if name not provided
      quantity: props.quantity,
      unitPrice: props.unitPrice,
      totalPrice: props.totalPrice,
    };
  }
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
  idempotencyKey: string;

  @ApiProperty({ description: "주문 생성일시" })
  createdAt: Date;

  @ApiProperty({ description: "주문 수정일시" })
  updatedAt: Date;

  static fromOrder(order: Order): OrderResponseDto {
    const props = order.toPersistence();
    return {
      id: props.id,
      userId: props.userId,
      items: props.OrderItems.map((item) =>
        OrderItemResponseDto.fromOrderItem(item)
      ),
      totalAmount: props.totalPrice,
      discountAmount: props.discountPrice,
      finalAmount: props.finalPrice,
      status: props.status as OrderStatus,
      usedCouponId: props.appliedCouponId,
      usedCouponName: props.appliedCouponId, // For simplicity
      idempotencyKey: props.idempotencyKey,
      createdAt: props.createdAt,
      updatedAt: props.updatedAt,
    };
  }
}
