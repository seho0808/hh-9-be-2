import { Test } from "@nestjs/testing";
import { ReserveStockUseCase } from "./reserve-stock.use-case";
import {
  ProductNotFoundError,
  InactiveProductError,
  InsufficientStockError,
  InvalidQuantityError,
} from "@/product/domain/exceptions/product.exceptions";
import { StockReservation } from "@/product/domain/entities/stock-reservation.entity";
import { Product } from "@/product/domain/entities/product.entity";
import { v4 as uuidv4 } from "uuid";

describe("ReserveStockUseCase", () => {
  let useCase: ReserveStockUseCase;
  let productRepository: any;
  let stockReservationRepository: any;

  beforeEach(async () => {
    productRepository = {
      findById: jest.fn(),
      save: jest.fn(),
    };

    stockReservationRepository = {
      save: jest.fn(),
    };

    const module = await Test.createTestingModule({
      providers: [
        ReserveStockUseCase,
        {
          provide: "ProductRepositoryInterface",
          useValue: productRepository,
        },
        {
          provide: "StockReservationRepositoryInterface",
          useValue: stockReservationRepository,
        },
      ],
    }).compile();

    useCase = module.get<ReserveStockUseCase>(ReserveStockUseCase);
  });

  const testCases: Array<
    [
      total: number,
      reserved: number,
      quantity: number,
      expected: number,
      desc: string,
    ]
  > = [
    [10, 0, 2, 8, "재고가 충분할 때"],
    [10, 5, 3, 2, "일부 재고가 예약된 상태에서 추가 예약할 때"],
    [10, 0, 10, 0, "전체 재고를 예약할 때"],
    [5, 2, 2, 1, "남은 재고가 예약 수량과 같을 때"],
    [1, 0, 1, 0, "재고가 1개일 때"],
  ];

  describe.each(testCases)(
    "재고 예약 성공 시 상품 및 예약 상태가 올바르게 변경되어야 한다",
    (
      totalStock,
      reservedStock,
      reservationQuantity,
      expectedAvailableStock,
      desc
    ) => {
      it(`${desc}`, async () => {
        const userId = uuidv4();
        const mockProduct = Product.create({
          name: "테스트 상품",
          description: "테스트 상품 설명",
          price: 1000,
          totalStock,
          reservedStock,
          isActive: true,
        });

        productRepository.findById.mockResolvedValue(mockProduct);

        const result = await useCase.execute({
          idempotencyKey: uuidv4(),
          productId: mockProduct.id,
          userId,
          quantity: reservationQuantity,
        });

        expect(result.product.getAvailableStock()).toBe(expectedAvailableStock);
        expect(result.stockReservation).toBeInstanceOf(StockReservation);
        expect(result.stockReservation.quantity).toBe(reservationQuantity);
        expect(result.stockReservation.userId).toBe(userId);
        expect(result.stockReservation.productId).toBe(mockProduct.id);
        expect(result.stockReservation.isActive).toBe(true);
      });
    }
  );

  describe.each([
    { quantity: 0, desc: "0일 때" },
    { quantity: -1, desc: "음수일 때" },
  ])("수량이 유효하지 않을 때 에러가 발생해야 한다", ({ quantity, desc }) => {
    it(`${desc}`, async () => {
      await expect(
        useCase.execute({
          idempotencyKey: uuidv4(),
          productId: "product-1",
          userId: uuidv4(),
          quantity,
        })
      ).rejects.toThrow(InvalidQuantityError);
    });
  });

  it("존재하지 않는 상품 ID로 요청시 에러가 발생해야 한다", async () => {
    productRepository.findById.mockResolvedValue(null);

    await expect(
      useCase.execute({
        idempotencyKey: uuidv4(),
        productId: "non-existent",
        userId: uuidv4(),
        quantity: 1,
      })
    ).rejects.toThrow(ProductNotFoundError);
  });

  it("비활성화된 상품으로 요청시 에러가 발생해야 한다", async () => {
    const mockProduct = Product.create({
      name: "비활성 상품",
      description: "비활성 상품 설명",
      price: 1000,
      totalStock: 10,
      reservedStock: 0,
      isActive: false,
    });

    productRepository.findById.mockResolvedValue(mockProduct);

    await expect(
      useCase.execute({
        idempotencyKey: uuidv4(),
        productId: mockProduct.id,
        userId: uuidv4(),
        quantity: 1,
      })
    ).rejects.toThrow(InactiveProductError);
  });

  it("재고가 부족할 때 에러가 발생해야 한다", async () => {
    const mockProduct = Product.create({
      name: "재고 부족 상품",
      description: "재고 부족 상품 설명",
      price: 1000,
      totalStock: 5,
      reservedStock: 4,
      isActive: true,
    });

    productRepository.findById.mockResolvedValue(mockProduct);

    await expect(
      useCase.execute({
        idempotencyKey: uuidv4(),
        productId: mockProduct.id,
        userId: uuidv4(),
        quantity: 2,
      })
    ).rejects.toThrow(InsufficientStockError);
  });
});
