import { ApiProperty } from "@nestjs/swagger";
import { IsOptional, IsString, IsBoolean, Min, Max } from "class-validator";
import { Type } from "class-transformer";
import { Product } from "@/product/domain/entities/product.entity";

export class ProductResponseDto {
  @ApiProperty({ description: "상품 ID" })
  id: string;

  @ApiProperty({ description: "상품명" })
  name: string;

  @ApiProperty({ description: "상품 설명" })
  description: string;

  @ApiProperty({ description: "상품 가격 (원)" })
  price: number;

  @ApiProperty({ description: "총 재고 수량" })
  totalStock: number;

  @ApiProperty({ description: "예약된 재고 수량" })
  reservedStock: number;

  @ApiProperty({ description: "활성화 상태" })
  isActive: boolean;

  @ApiProperty({ description: "생성일시" })
  createdAt: Date;

  @ApiProperty({ description: "수정일시" })
  updatedAt: Date;

  @ApiProperty({ description: "사용 가능한 재고" })
  availableStock: number;

  static fromProduct(product: Product): ProductResponseDto {
    const props = product.toPersistence();
    return {
      id: props.id,
      name: props.name,
      description: props.description,
      price: props.price,
      totalStock: props.totalStock,
      reservedStock: props.reservedStock,
      isActive: props.isActive,
      createdAt: props.createdAt,
      updatedAt: props.updatedAt,
      availableStock: product.getAvailableStock(),
    };
  }
}

export class ProductQueryDto {
  @ApiProperty({
    description: "검색 키워드",
    required: false,
    example: "스마트폰",
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiProperty({
    description: "활성화 상태 필터",
    required: false,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
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

export class PopularProductDto {
  @ApiProperty({ description: "상품 ID" })
  id: string;

  @ApiProperty({ description: "상품명" })
  name: string;

  @ApiProperty({ description: "상품 설명" })
  description: string;

  @ApiProperty({ description: "상품 가격 (원)" })
  price: number;

  @ApiProperty({ description: "사용 가능한 재고" })
  availableStock: number;

  @ApiProperty({ description: "총 판매량" })
  salesCount: number;

  @ApiProperty({ description: "총 주문 횟수" })
  totalOrders: number;

  static fromProductWithStats(
    product: Product,
    totalQuantity: number,
    totalOrders: number
  ): PopularProductDto {
    const props = product.toPersistence();
    return {
      id: props.id,
      name: props.name,
      description: props.description,
      price: props.price,
      availableStock: product.getAvailableStock(),
      salesCount: totalQuantity,
      totalOrders: totalOrders,
    };
  }
}
