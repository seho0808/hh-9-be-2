import { Test } from "@nestjs/testing";
import { ApplyDiscountUseCase } from "./apply-discount.use-case";
import { Order, OrderStatus } from "../entities/order.entitiy";
import { OrderNotFoundError } from "../exceptions/order.exceptions";
import { v4 as uuidv4 } from "uuid";

describe("ApplyDiscountUseCase", () => {
  let useCase: ApplyDiscountUseCase;
  let orderRepository: any;

  beforeEach(async () => {
    orderRepository = {
      findById: jest.fn(),
      save: jest.fn(),
    };

    const module = await Test.createTestingModule({
      providers: [
        ApplyDiscountUseCase,
        {
          provide: "OrderRepositoryInterface",
          useValue: orderRepository,
        },
      ],
    }).compile();

    useCase = module.get<ApplyDiscountUseCase>(ApplyDiscountUseCase);
  });

  const discountApplicationTestCases: Array<
    [
      totalPrice: number,
      discountPrice: number,
      discountedPrice: number,
      desc: string,
    ]
  > = [
    [10000, 1000, 9000, "10% 할인을 적용할 때"],
    [50000, 25000, 25000, "50% 할인을 적용할 때"],
    [1000, 100, 900, "최소 금액에 할인을 적용할 때"],
    [100000, 100000, 0, "100% 할인을 적용할 때"],
    [20000, 5000, 15000, "고정 금액 할인을 적용할 때"],
    [15000, 500, 14500, "소액 할인을 적용할 때"],
  ];

  describe.each(discountApplicationTestCases)(
    "할인 적용 성공 시 주문의 할인 정보가 올바르게 업데이트되어야 한다",
    (totalPrice, discountPrice, discountedPrice, desc) => {
      it(`${desc}`, async () => {
        // given
        const mockOrder = Order.create({
          userId: uuidv4(),
          totalPrice,
          discountPrice: 0,
          finalPrice: totalPrice,
          status: OrderStatus.PENDING,
          idempotencyKey: uuidv4(),
        });

        const appliedCouponId = uuidv4();
        const orderId = mockOrder.id;

        orderRepository.findById.mockResolvedValue(mockOrder);

        // when
        const result = await useCase.execute({
          orderId,
          appliedCouponId,
          discountPrice,
          discountedPrice,
        });

        // then
        expect(result.order.discountPrice).toBe(discountPrice);
        expect(result.order.finalPrice).toBe(discountedPrice);
        expect(result.order.appliedCouponId).toBe(appliedCouponId);
        expect(result.order.totalPrice).toBe(totalPrice); // 원가는 변경되지 않음
        expect(result.order.updatedAt).toBeInstanceOf(Date);
      });
    }
  );

  it("존재하지 않는 주문 ID로 할인 적용 시도할 때 OrderNotFoundError를 던져야 한다", async () => {
    // given
    const nonExistentOrderId = uuidv4();
    orderRepository.findById.mockResolvedValue(null);

    // when & then
    await expect(
      useCase.execute({
        orderId: nonExistentOrderId,
        appliedCouponId: uuidv4(),
        discountPrice: 1000,
        discountedPrice: 9000,
      })
    ).rejects.toThrow(OrderNotFoundError);
  });

  it("이미 할인이 적용된 주문에 새로운 할인을 적용할 때 기존 할인이 덮어써져야 한다", async () => {
    // given
    const mockOrder = Order.create({
      userId: uuidv4(),
      totalPrice: 20000,
      discountPrice: 0,
      finalPrice: 20000,
      status: OrderStatus.PENDING,
      idempotencyKey: uuidv4(),
    });

    // 첫 번째 할인 적용
    mockOrder.applyDiscount({
      appliedCouponId: "old-coupon",
      discountPrice: 2000,
      discountedPrice: 18000,
    });

    const newCouponId = uuidv4();
    orderRepository.findById.mockResolvedValue(mockOrder);

    // when
    const result = await useCase.execute({
      orderId: mockOrder.id,
      appliedCouponId: newCouponId,
      discountPrice: 5000,
      discountedPrice: 15000,
    });

    // then
    expect(result.order.appliedCouponId).toBe(newCouponId);
    expect(result.order.discountPrice).toBe(5000);
    expect(result.order.finalPrice).toBe(15000);
  });

  it("할인 적용 후 주문 상태는 변경되지 않아야 한다", async () => {
    // given
    const mockOrder = Order.create({
      userId: uuidv4(),
      totalPrice: 10000,
      discountPrice: 0,
      finalPrice: 10000,
      status: OrderStatus.PENDING,
      idempotencyKey: uuidv4(),
    });

    orderRepository.findById.mockResolvedValue(mockOrder);

    // when
    const result = await useCase.execute({
      orderId: mockOrder.id,
      appliedCouponId: uuidv4(),
      discountPrice: 1000,
      discountedPrice: 9000,
    });

    // then
    expect(result.order.status).toBe(OrderStatus.PENDING);
  });
});
