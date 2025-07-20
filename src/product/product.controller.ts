import { Controller, Get, Param, Query, UseGuards } from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from "@nestjs/swagger";
import { ProductMockService } from "./services/product.mock.service";
import {
  ProductResponseDto,
  ProductQueryDto,
  PopularProductDto,
} from "./dto/product.dto";
import {
  ApiResponseDto,
  PaginatedResponseDto,
} from "../common/dto/response.dto";
import { JwtAuthGuard } from "@/auth/guards/jwt-auth.guard";

@ApiTags("상품")
@Controller("products")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth("access-token")
export class ProductController {
  constructor(private readonly productService: ProductMockService) {}

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
    const result = await this.productService.getAllProducts(query);
    return ApiResponseDto.success(
      result,
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
    const result = await this.productService.getPopularProducts();
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
    const result = await this.productService.getProductById(productId);
    return ApiResponseDto.success(result, "상품을 성공적으로 조회했습니다");
  }
}
