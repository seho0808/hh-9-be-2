import { Test } from "@nestjs/testing";
import { ChangeOrderStatusUseCase } from "./change-order-status.use-case";
import { Order, OrderStatus } from "@/order/domain/entities/order.entitiy";
import { OrderNotFoundError } from "@/order/domain/exceptions/order.exceptions";
import { v4 as uuidv4 } from "uuid";

jest.mock("@/order/infrastructure/persistence/order.repository");
jest.mock("typeorm-transactional", () => ({
  Transactional: () => () => ({}),
}));

import { OrderRepository } from "@/order/infrastructure/persistence/order.repository";

describe("ChangeOrderStatusUseCase", () => {
  let useCase: ChangeOrderStatusUseCase;
  let orderRepository: jest.Mocked<OrderRepository>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [ChangeOrderStatusUseCase, OrderRepository],
    }).compile();

    useCase = module.get<ChangeOrderStatusUseCase>(ChangeOrderStatusUseCase);
    orderRepository = module.get<jest.Mocked<OrderRepository>>(OrderRepository);
  });

  const statusChangeTestCases: Array<
    [fromStatus: OrderStatus, toStatus: OrderStatus, desc: string]
  > = [
    [
      OrderStatus.PENDING,
      OrderStatus.SUCCESS,
      "대기 중인 주문을 성공으로 변경할 때",
    ],
    [
      OrderStatus.PENDING,
      OrderStatus.FAILED,
      "대기 중인 주문을 실패로 변경할 때",
    ],
    [
      OrderStatus.PENDING,
      OrderStatus.CANCELLED,
      "대기 중인 주문을 취소로 변경할 때",
    ],
    [
      OrderStatus.FAILED,
      OrderStatus.PENDING,
      "실패한 주문을 다시 대기로 변경할 때",
    ],
    [
      OrderStatus.SUCCESS,
      OrderStatus.CANCELLED,
      "성공한 주문을 취소로 변경할 때",
    ],
    [
      OrderStatus.CANCELLED,
      OrderStatus.PENDING,
      "취소된 주문을 다시 대기로 변경할 때",
    ],
  ];

  describe.each(statusChangeTestCases)(
    "주문 상태 변경 성공 시 새로운 상태가 올바르게 적용되어야 한다",
    (fromStatus, toStatus, desc) => {
      it(`${desc}`, async () => {
        // given
        const mockOrder = Order.create({
          userId: uuidv4(),
          totalPrice: 10000,
          discountPrice: 0,
          finalPrice: 10000,
          status: fromStatus,
          idempotencyKey: uuidv4(),
        });

        const orderId = mockOrder.id;
        const originalUpdatedAt = mockOrder.updatedAt;

        orderRepository.findById.mockResolvedValue(mockOrder);

        jest.useFakeTimers();
        jest.advanceTimersByTime(10);

        // when
        const result = await useCase.execute({
          orderId,
          status: toStatus,
        });

        // then
        expect(result.order.status).toBe(toStatus);
        expect(result.order.updatedAt.getTime()).toBeGreaterThan(
          originalUpdatedAt.getTime()
        );
        expect(result.order.id).toBe(orderId);
      });
    }
  );

  it("존재하지 않는 주문 ID로 상태 변경 시도할 때 OrderNotFoundError를 던져야 한다", async () => {
    // given
    const nonExistentOrderId = uuidv4();
    orderRepository.findById.mockResolvedValue(null);

    // when & then
    await expect(
      useCase.execute({
        orderId: nonExistentOrderId,
        status: OrderStatus.SUCCESS,
      })
    ).rejects.toThrow(OrderNotFoundError);
  });

  it("동일한 상태로 변경할 때도 정상적으로 처리되어야 한다", async () => {
    // given
    const mockOrder = Order.create({
      userId: uuidv4(),
      totalPrice: 10000,
      discountPrice: 0,
      finalPrice: 10000,
      status: OrderStatus.PENDING,
      idempotencyKey: uuidv4(),
    });

    const orderId = mockOrder.id;
    const originalUpdatedAt = mockOrder.updatedAt;

    orderRepository.findById.mockResolvedValue(mockOrder);

    jest.useFakeTimers();
    jest.advanceTimersByTime(10);

    // when
    const result = await useCase.execute({
      orderId,
      status: OrderStatus.PENDING, // 동일한 상태로 변경
    });

    // then
    expect(result.order.status).toBe(OrderStatus.PENDING);
    expect(result.order.updatedAt.getTime()).toBeGreaterThan(
      originalUpdatedAt.getTime()
    );
  });

  it("상태 변경 시 주문의 다른 정보는 변경되지 않아야 한다", async () => {
    // given
    const mockOrder = Order.create({
      userId: uuidv4(),
      totalPrice: 15000,
      discountPrice: 1000,
      finalPrice: 14000,
      status: OrderStatus.PENDING,
      idempotencyKey: uuidv4(),
    });

    // 할인 적용
    mockOrder.applyDiscount({
      appliedCouponId: "test-coupon",
      discountPrice: 1000,
      discountedPrice: 14000,
    });

    const orderId = mockOrder.id;
    const originalUserId = mockOrder.userId;
    const originalTotalPrice = mockOrder.totalPrice;
    const originalDiscountPrice = mockOrder.discountPrice;
    const originalFinalPrice = mockOrder.finalPrice;
    const originalAppliedCouponId = mockOrder.appliedCouponId;
    const originalIdempotencyKey = mockOrder.idempotencyKey;

    orderRepository.findById.mockResolvedValue(mockOrder);

    // when
    const result = await useCase.execute({
      orderId,
      status: OrderStatus.SUCCESS,
    });

    // then
    expect(result.order.status).toBe(OrderStatus.SUCCESS);
    expect(result.order.userId).toBe(originalUserId);
    expect(result.order.totalPrice).toBe(originalTotalPrice);
    expect(result.order.discountPrice).toBe(originalDiscountPrice);
    expect(result.order.finalPrice).toBe(originalFinalPrice);
    expect(result.order.appliedCouponId).toBe(originalAppliedCouponId);
    expect(result.order.idempotencyKey).toBe(originalIdempotencyKey);
  });
});
