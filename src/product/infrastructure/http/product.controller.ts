import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  UseFilters,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from "@nestjs/swagger";
import { ProductApplicationService } from "@/product/application/services/product.service";
import {
  ProductResponseDto,
  ProductQueryDto,
  PopularProductDto,
} from "./dto/product.dto";
import {
  ApiResponseDto,
  PaginatedResponseDto,
} from "@/common/dto/response.dto";
import { JwtAuthGuard } from "@/auth/guards/jwt-auth.guard";
import { Product } from "@/product/domain/entities/product.entity";
import { ProductExceptionFilter } from "./filters/product-exception.filter";

@ApiTags("상품")
@Controller("products")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth("access-token")
@UseFilters(ProductExceptionFilter)
export class ProductController {
  constructor(
    private readonly productApplicationService: ProductApplicationService
  ) {}

  @Get()
  @ApiOperation({ summary: "전체 상품 조회" })
  @ApiResponse({
    status: 200,
    description: "상품 목록 조회 성공",
    type: PaginatedResponseDto<ProductResponseDto>,
  })
  async getAllProducts(
    @Query() query: ProductQueryDto
  ): Promise<ApiResponseDto<PaginatedResponseDto<ProductResponseDto>>> {
    const result = await this.productApplicationService.getAllProducts({
      page: query.page,
      limit: query.limit,
      search: query.search,
      isActive: query.isActive,
    });

    const responseProducts = result.products.map((product) =>
      ProductResponseDto.fromProduct(product)
    );

    const paginatedResult = new PaginatedResponseDto(
      responseProducts,
      result.total,
      result.page,
      result.limit
    );

    return ApiResponseDto.success(
      paginatedResult,
      "상품 목록을 성공적으로 조회했습니다"
    );
  }

  @Get("popular")
  @ApiOperation({ summary: "인기 상품 조회" })
  @ApiResponse({
    status: 200,
    description: "인기 상품 조회 성공",
    type: [PopularProductDto],
  })
  async getPopularProducts(): Promise<ApiResponseDto<PopularProductDto[]>> {
    const popularProducts =
      await this.productApplicationService.getPopularProducts();

    const result = popularProducts.map((item) =>
      PopularProductDto.fromProductWithStats(
        item.product,
        item.statistics.totalQuantity,
        item.statistics.totalOrders
      )
    );

    return ApiResponseDto.success(
      result,
      "인기 상품을 성공적으로 조회했습니다"
    );
  }

  @Get(":productId")
  @ApiOperation({ summary: "단일 상품 조회" })
  @ApiParam({
    name: "productId",
    description: "상품 ID",
    example: "product-1",
  })
  @ApiResponse({
    status: 200,
    description: "상품 조회 성공",
    type: ProductResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: "상품을 찾을 수 없음",
  })
  async getProductById(
    @Param("productId") productId: string
  ): Promise<ApiResponseDto<ProductResponseDto>> {
    const product =
      await this.productApplicationService.getProductById(productId);
    const result = ProductResponseDto.fromProduct(product);

    return ApiResponseDto.success(result, "상품을 성공적으로 조회했습니다");
  }
}
