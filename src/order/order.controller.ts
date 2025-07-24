import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from "@nestjs/swagger";
import {
  CreateOrderDto,
  OrderResponseDto,
  OrderQueryDto,
  OrderSummaryDto,
} from "./dto/order.dto";
import {
  ApiResponseDto,
  PaginatedResponseDto,
} from "../common/dto/response.dto";
import { JwtAuthGuard } from "@/auth/guards/jwt-auth.guard";
import {
  CurrentUser,
  CurrentUserData,
} from "../common/decorators/current-user.decorator";

@ApiTags("주문/결제")
@Controller("orders")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth("access-token")
export class OrderController {
  @Post()
  @ApiOperation({ summary: "주문 생성 및 결제" })
  @ApiResponse({
    status: 201,
    description: "주문 생성 성공",
    type: OrderResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: "주문 생성 실패 (재고부족, 잔액부족, 쿠폰오류 등)",
  })
  @ApiResponse({
    status: 409,
    description: "중복 요청",
  })
  async createOrder(
    @CurrentUser() user: CurrentUserData,
    @Body() createOrderDto: CreateOrderDto
  ): Promise<ApiResponseDto<OrderResponseDto>> {
    return ApiResponseDto.success(null, "주문이 성공적으로 완료되었습니다");
  }

  @Get(":orderId")
  @ApiOperation({ summary: "주문 상세 조회" })
  @ApiParam({
    name: "orderId",
    description: "주문 ID",
    example: "order-1",
  })
  @ApiResponse({
    status: 200,
    description: "주문 조회 성공",
    type: OrderResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: "주문을 찾을 수 없음",
  })
  async getOrderById(
    @CurrentUser() user: CurrentUserData,
    @Param("orderId") orderId: string
  ): Promise<ApiResponseDto<OrderResponseDto>> {
    return ApiResponseDto.success(null, "주문 정보를 조회했습니다");
  }
}

@ApiTags("사용자 주문")
@Controller("users/me/orders")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth("access-token")
export class UserOrderController {
  @Get()
  @ApiOperation({ summary: "내 주문 목록" })
  @ApiResponse({
    status: 200,
    description: "주문 목록 조회 성공",
    type: PaginatedResponseDto<OrderResponseDto>,
  })
  async getMyOrders(
    @CurrentUser() user: CurrentUserData,
    @Query() query: OrderQueryDto
  ): Promise<ApiResponseDto<PaginatedResponseDto<OrderResponseDto>>> {
    return ApiResponseDto.success(null, "주문 목록을 조회했습니다");
  }
}
