import {
  Controller,
  Get,
  Post,
  Param,
  Body,
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
import { CreateOrderDto, OrderResponseDto } from "./dto/order.dto";
import {
  ApiResponseDto,
  PaginatedResponseDto,
} from "../../../common/dto/response.dto";
import { JwtAuthGuard } from "@/auth/guards/jwt-auth.guard";
import {
  CurrentUser,
  CurrentUserData,
} from "../../../common/decorators/current-user.decorator";
import { OrderApplicationService } from "@/order/application/order.service";
import { OrderExceptionFilter } from "./filters/order-exception.filter";
import { v4 as uuidv4 } from "uuid";
import { OrderNotFoundHttpError } from "./exceptions";

@ApiTags("주문/결제")
@Controller("orders")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth("access-token")
@UseFilters(OrderExceptionFilter)
export class OrderController {
  constructor(
    private readonly orderApplicationService: OrderApplicationService
  ) {}

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
    const idempotencyKey = createOrderDto.idempotencyKey || uuidv4();

    const { order } = await this.orderApplicationService.placeOrder({
      userId: user.id,
      couponId: createOrderDto.couponId || null,
      idempotencyKey,
      itemsWithoutPrices: createOrderDto.items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
      })),
    });

    const response = OrderResponseDto.fromEntity(order);
    return ApiResponseDto.success(response, "주문이 성공적으로 완료되었습니다");
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
    const order = await this.orderApplicationService.getOrderById(orderId);
    if (!order) {
      throw new OrderNotFoundHttpError(orderId);
    }
    return ApiResponseDto.success(
      OrderResponseDto.fromEntity(order),
      "주문 정보를 조회했습니다"
    );
  }
}

@ApiTags("사용자 주문")
@Controller("users/me/orders")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth("access-token")
@UseFilters(OrderExceptionFilter)
export class UserOrderController {
  constructor(
    private readonly orderApplicationService: OrderApplicationService
  ) {}

  @Get()
  @ApiOperation({ summary: "내 주문 목록" })
  @ApiResponse({
    status: 200,
    description: "주문 목록 조회 성공",
    type: PaginatedResponseDto<OrderResponseDto>,
  })
  async getMyOrders(
    @CurrentUser() user: CurrentUserData
  ): Promise<ApiResponseDto<OrderResponseDto[]>> {
    const orders = await this.orderApplicationService.getOrdersByUserId(
      user.id
    );
    const response = orders.map((order) => OrderResponseDto.fromEntity(order));
    return ApiResponseDto.success(response, "주문 목록을 조회했습니다");
  }
}
