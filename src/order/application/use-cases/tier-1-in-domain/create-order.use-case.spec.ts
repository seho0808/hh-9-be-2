import { Test } from "@nestjs/testing";
import { CreateOrderUseCase } from "./create-order.use-case";
import { OrderStatus } from "@/order/domain/entities/order.entitiy";
import { v4 as uuidv4 } from "uuid";
import { CreateOrderDomainService } from "@/order/domain/services/create-order.service";

describe("CreateOrderUseCase", () => {
  let useCase: CreateOrderUseCase;
  let orderRepository: any;
  let orderItemRepository: any;

  beforeEach(async () => {
    orderRepository = {
      save: jest.fn(),
    };

    orderItemRepository = {
      save: jest.fn(),
    };

    const module = await Test.createTestingModule({
      providers: [
        CreateOrderUseCase,
        CreateOrderDomainService,
        {
          provide: "OrderRepositoryInterface",
          useValue: orderRepository,
        },
        {
          provide: "OrderItemRepositoryInterface",
          useValue: orderItemRepository,
        },
      ],
    }).compile();

    useCase = module.get<CreateOrderUseCase>(CreateOrderUseCase);
  });

  const orderCreationTestCases: Array<
    [
      itemCount: number,
      unitPrice: number,
      quantity: number,
      expectedTotalPrice: number,
      desc: string,
    ]
  > = [
    [1, 1000, 1, 1000, "단일 아이템으로 주문 생성할 때"],
    [1, 10000, 5, 50000, "단일 아이템을 다수 수량으로 주문 생성할 때"],
    [3, 1000, 2, 6000, "다수 아이템으로 주문 생성할 때"],
    [1, 100, 100, 10000, "최대 수량으로 주문 생성할 때"],
    [1, 1, 1, 1, "최소 가격과 수량으로 주문 생성할 때"],
  ];

  describe.each(orderCreationTestCases)(
    "주문 생성 성공 시 올바른 주문과 주문 아이템이 생성되어야 한다",
    (itemCount, unitPrice, quantity, expectedTotalPrice, desc) => {
      it(`${desc}`, async () => {
        // given
        const userId = uuidv4();
        const productId = uuidv4();
        const idempotencyKey = uuidv4();

        const items = Array.from({ length: itemCount }, (_, index) => ({
          productId: `product-${index + 1}`,
          unitPrice,
          quantity,
        }));

        // when
        const result = await useCase.execute({
          userId,
          idempotencyKey,
          items,
        });

        // then
        expect(result.order.userId).toBe(userId);
        expect(result.order.totalPrice).toBe(expectedTotalPrice);
        expect(result.order.finalPrice).toBe(expectedTotalPrice);
        expect(result.order.discountPrice).toBe(0);
        expect(result.order.status).toBe(OrderStatus.PENDING);
        expect(result.order.idempotencyKey).toBe(idempotencyKey);
        expect(result.order.orderItems).toHaveLength(itemCount);
      });
    }
  );

  it("빈 아이템 목록으로 주문 생성할 때 총 가격이 0이 되어야 한다", async () => {
    // given
    const userId = uuidv4();
    const productId = uuidv4();
    const idempotencyKey = uuidv4();

    orderRepository.save.mockImplementation((order) => Promise.resolve(order));

    // when
    const result = await useCase.execute({
      userId,
      idempotencyKey,
      items: [],
    });

    // then
    expect(result.order.totalPrice).toBe(0);
    expect(result.order.finalPrice).toBe(0);
    expect(result.order.orderItems).toHaveLength(0);
  });

  it("주문 생성 시 초기 상태값들이 올바르게 설정되어야 한다", async () => {
    // given
    const userId = uuidv4();
    const productId = uuidv4();
    const idempotencyKey = uuidv4();
    const items = [{ productId, unitPrice: 1000, quantity: 1 }];

    // when
    const result = await useCase.execute({
      userId,
      idempotencyKey,
      items,
    });

    // then
    expect(result.order.status).toBe(OrderStatus.PENDING);
    expect(result.order.discountPrice).toBe(0);
    expect(result.order.appliedCouponId).toBeNull();
    expect(result.order.id).toBeDefined();
    expect(result.order.createdAt).toBeInstanceOf(Date);
    expect(result.order.updatedAt).toBeInstanceOf(Date);
  });
});
