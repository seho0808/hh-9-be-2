import { ApiProperty } from "@nestjs/swagger";
import { IsOptional, IsString, IsBoolean, Min, Max } from "class-validator";
import { Type } from "class-transformer";
import { Product } from "@/product/domain/entities/product.entity";

export class ProductResponseDto {
  @ApiProperty({
    description: "상품 ID",
    example: "product-123",
  })
  id: string;

  @ApiProperty({
    description: "상품명",
    example: "iPhone 15 Pro",
  })
  name: string;

  @ApiProperty({
    description: "상품 설명",
    example: "Apple의 최신 프리미엄 스마트폰",
  })
  description: string;

  @ApiProperty({
    description: "상품 가격 (원)",
    example: 1500000,
  })
  price: number;

  @ApiProperty({
    description: "총 재고 수량",
    example: 100,
  })
  totalStock: number;

  @ApiProperty({
    description: "예약된 재고 수량",
    example: 5,
  })
  reservedStock: number;

  @ApiProperty({
    description: "사용 가능한 재고",
    example: 95,
  })
  availableStock: number;

  @ApiProperty({
    description: "활성화 상태",
    example: true,
  })
  isActive: boolean;

  @ApiProperty({
    description: "생성일시",
    example: "2024-01-15T10:30:00.000Z",
  })
  createdAt: Date;

  @ApiProperty({
    description: "수정일시",
    example: "2024-01-15T10:30:00.000Z",
  })
  updatedAt: Date;

  static fromEntity(product: Product): ProductResponseDto {
    return {
      id: product.id,
      name: product.name,
      description: product.description,
      price: product.price,
      totalStock: product.totalStock,
      reservedStock: product.reservedStock,
      availableStock: product.getAvailableStock(),
      isActive: product.isActive,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    };
  }
}

export class ProductQueryDto {
  @ApiProperty({
    description: "검색 키워드",
    required: false,
    example: "iPhone",
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiProperty({
    description: "활성화 상태 필터",
    required: false,
    default: true,
    example: true,
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
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @Min(1, { message: "페이지 번호는 1 이상이어야 합니다" })
  page?: number = 1;

  @ApiProperty({
    description: "페이지당 항목 수",
    required: false,
    default: 10,
    minimum: 1,
    maximum: 100,
    example: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @Min(1, { message: "페이지당 항목 수는 1 이상이어야 합니다" })
  @Max(100, { message: "페이지당 최대 항목 수는 100개입니다" })
  limit?: number = 10;
}

export class PopularProductDto {
  @ApiProperty({
    description: "상품 ID",
    example: "product-123",
  })
  id: string;

  @ApiProperty({
    description: "상품명",
    example: "iPhone 15 Pro",
  })
  name: string;

  @ApiProperty({
    description: "상품 설명",
    example: "Apple의 최신 프리미엄 스마트폰",
  })
  description: string;

  @ApiProperty({
    description: "상품 가격 (원)",
    example: 1500000,
  })
  price: number;

  @ApiProperty({
    description: "사용 가능한 재고",
    example: 95,
  })
  availableStock: number;

  @ApiProperty({
    description: "총 판매량",
    example: 150,
  })
  salesCount: number;

  static fromEntity(
    product: Product,
    totalQuantity: number
  ): PopularProductDto {
    return {
      id: product.id,
      name: product.name,
      description: product.description,
      price: product.price,
      availableStock: product.getAvailableStock(),
      salesCount: totalQuantity,
    };
  }
}
