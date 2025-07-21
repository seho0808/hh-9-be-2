import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from "@nestjs/common";
import {
  CreateOrderDto,
  OrderResponseDto,
  OrderQueryDto,
  OrderSummaryDto,
  OrderStatus,
  OrderItemResponseDto,
} from "../dto/order.dto";
import { PaginatedResponseDto } from "../../common/dto/response.dto";
import { ProductApplicationService } from "../../product/application/services/product.service";
import { WalletMockService } from "../../wallet/services/wallet.mock.service";
import { CouponMockService } from "../../coupon/services/coupon.mock.service";

interface MockOrder {
  id: string;
  userId: string;
  items: MockOrderItem[];
  totalAmount: number;
  discountAmount: number;
  finalAmount: number;
  status: OrderStatus;
  usedCouponId?: string;
  requestId: string;
  createdAt: Date;
  updatedAt: Date;
}

interface MockOrderItem {
  id: string;
  orderId: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

@Injectable()
export class OrderMockService {
  // Mock 주문 데이터베이스
  private mockOrders: MockOrder[] = [
    {
      id: "order-1",
      userId: "user-123",
      items: [
        {
          id: "order-item-1",
          orderId: "order-1",
          productId: "product-1",
          productName: "iPhone 15 Pro",
          quantity: 1,
          unitPrice: 1290000,
          totalPrice: 1290000,
        },
      ],
      totalAmount: 1290000,
      discountAmount: 5000,
      finalAmount: 1285000,
      status: OrderStatus.SUCCESS,
      usedCouponId: "coupon-2",
      requestId: "order_user123_20240101_001",
      createdAt: new Date("2024-01-10"),
      updatedAt: new Date("2024-01-10"),
    },
    {
      id: "order-2",
      userId: "user-123",
      items: [
        {
          id: "order-item-2",
          orderId: "order-2",
          productId: "product-4",
          productName: "AirPods Pro",
          quantity: 2,
          unitPrice: 329000,
          totalPrice: 658000,
        },
      ],
      totalAmount: 658000,
      discountAmount: 0,
      finalAmount: 658000,
      status: OrderStatus.SUCCESS,
      requestId: "order_user123_20240105_001",
      createdAt: new Date("2024-01-05"),
      updatedAt: new Date("2024-01-05"),
    },
  ];

  private orderIdCounter = 3;
  private orderItemIdCounter = 3;

  constructor(
    private readonly productService: ProductApplicationService,
    private readonly walletService: WalletMockService,
    private readonly couponService: CouponMockService
  ) {}

  async createOrder(
    userId: string,
    createOrderDto: CreateOrderDto
  ): Promise<OrderResponseDto> {
    const { items, couponId, requestId } = createOrderDto;

    // 중복 요청 확인
    if (requestId) {
      const existingOrder = this.mockOrders.find(
        (o) => o.requestId === requestId
      );
      if (existingOrder) {
        throw new ConflictException("이미 처리된 주문 요청입니다");
      }
    }

    // 총 수량 확인 (최대 30개)
    const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
    if (totalQuantity > 30) {
      throw new BadRequestException("한 주문 내 총 수량은 최대 30개입니다");
    }

    // 1. 상품 정보 및 재고 확인
    const orderItems: MockOrderItem[] = [];
    let totalAmount = 0;

    for (const item of items) {
      const product = await this.productService.getProductById(item.productId);

      if (!product.isActive) {
        throw new BadRequestException(
          `상품 '${product.name}'은 판매 중단된 상품입니다`
        );
      }

      if (product.getAvailableStock() < item.quantity) {
        throw new BadRequestException(
          `상품 '${product.name}'의 재고가 부족합니다 (요청: ${item.quantity}, 재고: ${product.getAvailableStock()})`
        );
      }

      const itemTotal = product.price * item.quantity;
      totalAmount += itemTotal;

      orderItems.push({
        id: `order-item-${this.orderItemIdCounter++}`,
        orderId: "", // 나중에 설정
        productId: product.id,
        productName: product.name,
        quantity: item.quantity,
        unitPrice: product.price,
        totalPrice: itemTotal,
      });
    }

    // 2. 쿠폰 할인 계산
    let discountAmount = 0;
    let usedCouponName: string | undefined;

    if (couponId) {
      const discountCalculation = await this.couponService.calculateDiscount(
        couponId,
        totalAmount
      );
      discountAmount = discountCalculation.discountAmount;
      usedCouponName = discountCalculation.appliedCoupon.name;
    }

    const finalAmount = totalAmount - discountAmount;

    // 3. 잔액 확인
    const userBalance = await this.walletService.getUserBalance(userId);
    if (userBalance.balance < finalAmount) {
      throw new BadRequestException("잔액이 부족합니다");
    }

    // 4. 주문 생성
    const orderId = `order-${this.orderIdCounter++}`;
    const now = new Date();

    // 주문 항목에 orderId 설정
    orderItems.forEach((item) => {
      item.orderId = orderId;
    });

    const newOrder: MockOrder = {
      id: orderId,
      userId,
      items: orderItems,
      totalAmount,
      discountAmount,
      finalAmount,
      status: OrderStatus.SUCCESS, // Mock에서는 항상 성공으로 처리
      usedCouponId: couponId,
      requestId: requestId || `order_${userId}_${Date.now()}`,
      createdAt: now,
      updatedAt: now,
    };

    // 5. 실제 처리 시뮬레이션
    try {
      // 잔액 차감
      await this.walletService.deductBalance(
        userId,
        finalAmount,
        "상품 주문",
        orderId
      );

      // 쿠폰 사용 처리
      if (couponId) {
        await this.couponService.validateAndUseCoupon(
          userId,
          couponId,
          totalAmount
        );
      }

      // 주문 저장
      this.mockOrders.push(newOrder);

      return this.toOrderResponseDto(newOrder);
    } catch (error) {
      // 실패 시 주문 상태를 FAILED로 변경하고 자동 복구 처리 (실제로는 더 복잡한 로직 필요)
      newOrder.status = OrderStatus.FAILED;
      this.mockOrders.push(newOrder);

      throw new BadRequestException("주문 처리 중 오류가 발생했습니다");
    }
  }

  async getOrderById(
    orderId: string,
    userId?: string
  ): Promise<OrderResponseDto> {
    const order = this.mockOrders.find((o) => o.id === orderId);
    if (!order) {
      throw new NotFoundException("주문을 찾을 수 없습니다");
    }

    // 사용자 본인의 주문인지 확인 (선택사항)
    if (userId && order.userId !== userId) {
      throw new NotFoundException("주문을 찾을 수 없습니다");
    }

    return this.toOrderResponseDto(order);
  }

  async getUserOrders(
    userId: string,
    query: OrderQueryDto
  ): Promise<PaginatedResponseDto<OrderResponseDto>> {
    let userOrders = this.mockOrders.filter((o) => o.userId === userId);

    // 상태 필터
    if (query.status) {
      userOrders = userOrders.filter((o) => o.status === query.status);
    }

    // 최신순 정렬
    userOrders.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    // 페이지네이션
    const page = query.page || 1;
    const limit = query.limit || 10;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;

    const paginatedOrders = userOrders.slice(startIndex, endIndex);

    const responseOrders: OrderResponseDto[] = paginatedOrders.map((o) =>
      this.toOrderResponseDto(o)
    );

    return new PaginatedResponseDto(
      responseOrders,
      userOrders.length,
      page,
      limit
    );
  }

  async calculateOrderSummary(
    userId: string,
    items: any[],
    couponId?: string
  ): Promise<OrderSummaryDto> {
    // 상품 정보 조회 및 총액 계산
    let totalAmount = 0;

    for (const item of items) {
      const product = await this.productService.getProductById(item.productId);
      totalAmount += product.price * item.quantity;
    }

    // 쿠폰 할인 계산
    let discountAmount = 0;
    let appliedCoupon: any = undefined;

    if (couponId) {
      try {
        const discountCalculation = await this.couponService.calculateDiscount(
          couponId,
          totalAmount
        );
        discountAmount = discountCalculation.discountAmount;
        appliedCoupon = {
          id: discountCalculation.appliedCoupon.id,
          name: discountCalculation.appliedCoupon.name,
          discountAmount,
        };
      } catch (error) {
        // 쿠폰 오류는 무시하고 할인 없이 계산
      }
    }

    const finalAmount = totalAmount - discountAmount;

    // 잔액 확인
    const userBalance = await this.walletService.getUserBalance(userId);
    const isInsufficientBalance = userBalance.balance < finalAmount;

    return {
      totalAmount,
      discountAmount,
      finalAmount,
      availableBalance: userBalance.balance,
      isInsufficientBalance,
      appliedCoupon,
    };
  }

  private toOrderResponseDto(order: MockOrder): OrderResponseDto {
    // 쿠폰명 조회 (실제로는 JOIN 쿼리나 캐시 사용)
    let usedCouponName: string | undefined;
    if (order.usedCouponId) {
      // Mock 데이터에서 쿠폰명 찾기 (실제로는 서비스 호출)
      const couponNames = {
        "coupon-1": "신규 회원 환영 쿠폰",
        "coupon-2": "봄맞이 5천원 할인",
        "coupon-3": "VIP 고객 20% 할인",
      };
      usedCouponName = couponNames[order.usedCouponId];
    }

    return {
      id: order.id,
      userId: order.userId,
      items: order.items.map((item) => ({
        id: item.id,
        productId: item.productId,
        productName: item.productName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: item.totalPrice,
      })),
      totalAmount: order.totalAmount,
      discountAmount: order.discountAmount,
      finalAmount: order.finalAmount,
      status: order.status,
      usedCouponId: order.usedCouponId,
      usedCouponName,
      requestId: order.requestId,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    };
  }
}
