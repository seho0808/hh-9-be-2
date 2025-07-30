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
import { ProductExceptionFilter } from "./filters/product-exception.filter";
import { GetAllProductsUseCase } from "@/product/application/use-cases/tier-1-in-domain/get-all-products.use-case";
import { GetProductByIdUseCase } from "@/product/application/use-cases/tier-1-in-domain/get-product-by-id.use-case";
import { GetPopularProductsWithDetailUseCase } from "@/product/application/use-cases/tier-2/get-popular-products-with-detail.use-case";

@ApiTags("상품")
@Controller("products")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth("access-token")
@UseFilters(ProductExceptionFilter)
export class ProductController {
  constructor(
    private readonly getAllProductsUseCase: GetAllProductsUseCase,
    private readonly getPopularProductsWithDetailUseCase: GetPopularProductsWithDetailUseCase,
    private readonly getProductByIdUseCase: GetProductByIdUseCase
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
    const result = await this.getAllProductsUseCase.execute({
      page: query.page,
      limit: query.limit,
      search: query.search,
      isActive: query.isActive,
    });

    const responseProducts = result.products.map((product) =>
      ProductResponseDto.fromEntity(product)
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
    const { popularProductsStats } =
      await this.getPopularProductsWithDetailUseCase.execute({
        limit: 10,
      });

    const result = popularProductsStats.map((item) =>
      PopularProductDto.fromEntity(
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
    const product = await this.getProductByIdUseCase.execute(productId);
    const result = ProductResponseDto.fromEntity(product);

    return ApiResponseDto.success(result, "상품을 성공적으로 조회했습니다");
  }
}
