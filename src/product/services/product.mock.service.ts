import { Injectable, NotFoundException } from "@nestjs/common";
import {
  ProductResponseDto,
  ProductQueryDto,
  PopularProductDto,
} from "../dto/product.dto";
import { PaginatedResponseDto } from "../../common/dto/response.dto";

@Injectable()
export class ProductMockService {
  // Mock 상품 데이터베이스
  private mockProducts = [
    {
      id: "product-1",
      name: "iPhone 15 Pro",
      description: "애플의 최신 프리미엄 스마트폰",
      price: 1290000,
      totalStock: 100,
      reservedStock: 5,
      isActive: true,
      createdAt: new Date("2024-01-01"),
      updatedAt: new Date("2024-01-01"),
      salesCount: 45,
      lastOrderAt: new Date("2024-01-15"),
    },
    {
      id: "product-2",
      name: "Galaxy S24 Ultra",
      description: "삼성의 플래그십 스마트폰",
      price: 1350000,
      totalStock: 80,
      reservedStock: 3,
      isActive: true,
      createdAt: new Date("2024-01-01"),
      updatedAt: new Date("2024-01-01"),
      salesCount: 38,
      lastOrderAt: new Date("2024-01-14"),
    },
    {
      id: "product-3",
      name: 'MacBook Pro 16"',
      description: "Apple M3 Pro 칩이 탑재된 프로용 노트북",
      price: 3290000,
      totalStock: 50,
      reservedStock: 2,
      isActive: true,
      createdAt: new Date("2024-01-01"),
      updatedAt: new Date("2024-01-01"),
      salesCount: 25,
      lastOrderAt: new Date("2024-01-13"),
    },
    {
      id: "product-4",
      name: "AirPods Pro",
      description: "액티브 노이즈 캔슬링 무선 이어폰",
      price: 329000,
      totalStock: 200,
      reservedStock: 10,
      isActive: true,
      createdAt: new Date("2024-01-01"),
      updatedAt: new Date("2024-01-01"),
      salesCount: 67,
      lastOrderAt: new Date("2024-01-15"),
    },
    {
      id: "product-5",
      name: "iPad Air",
      description: "M2 칩이 탑재된 가볍고 강력한 태블릿",
      price: 929000,
      totalStock: 75,
      reservedStock: 4,
      isActive: true,
      createdAt: new Date("2024-01-01"),
      updatedAt: new Date("2024-01-01"),
      salesCount: 32,
      lastOrderAt: new Date("2024-01-12"),
    },
    {
      id: "product-6",
      name: "Nintendo Switch",
      description: "휴대용 게임 콘솔",
      price: 349000,
      totalStock: 120,
      reservedStock: 8,
      isActive: true,
      createdAt: new Date("2024-01-01"),
      updatedAt: new Date("2024-01-01"),
      salesCount: 15,
      lastOrderAt: new Date("2024-01-10"),
    },
  ];

  async getAllProducts(
    query: ProductQueryDto
  ): Promise<PaginatedResponseDto<ProductResponseDto>> {
    let filteredProducts = this.mockProducts;

    // 활성화 상태 필터
    if (query.isActive !== undefined) {
      filteredProducts = filteredProducts.filter(
        (p) => p.isActive === query.isActive
      );
    }

    // 검색 키워드 필터
    if (query.search) {
      const searchLower = query.search.toLowerCase();
      filteredProducts = filteredProducts.filter(
        (p) =>
          p.name.toLowerCase().includes(searchLower) ||
          p.description.toLowerCase().includes(searchLower)
      );
    }

    // 페이지네이션
    const page = query.page || 1;
    const limit = query.limit || 10;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;

    const paginatedProducts = filteredProducts.slice(startIndex, endIndex);

    const responseProducts: ProductResponseDto[] = paginatedProducts.map(
      (p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        price: p.price,
        totalStock: p.totalStock,
        reservedStock: p.reservedStock,
        isActive: p.isActive,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
        availableStock: p.totalStock - p.reservedStock,
      })
    );

    return new PaginatedResponseDto(
      responseProducts,
      filteredProducts.length,
      page,
      limit
    );
  }

  async getProductById(productId: string): Promise<ProductResponseDto> {
    const product = this.mockProducts.find((p) => p.id === productId);
    if (!product) {
      throw new NotFoundException("상품을 찾을 수 없습니다");
    }

    return {
      id: product.id,
      name: product.name,
      description: product.description,
      price: product.price,
      totalStock: product.totalStock,
      reservedStock: product.reservedStock,
      isActive: product.isActive,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
      availableStock: product.totalStock - product.reservedStock,
    };
  }

  async getPopularProducts(): Promise<PopularProductDto[]> {
    // 최근 3일간 판매량 기준으로 정렬
    const popularProducts = this.mockProducts
      .filter((p) => p.isActive && p.salesCount > 0)
      .sort((a, b) => {
        if (b.salesCount === a.salesCount) {
          // 판매량이 같으면 최근 주문 시간 기준
          return b.lastOrderAt.getTime() - a.lastOrderAt.getTime();
        }
        return b.salesCount - a.salesCount;
      })
      .slice(0, 5); // 상위 5개

    return popularProducts.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      price: p.price,
      availableStock: p.totalStock - p.reservedStock,
      salesCount: p.salesCount,
      lastOrderAt: p.lastOrderAt,
    }));
  }
}
