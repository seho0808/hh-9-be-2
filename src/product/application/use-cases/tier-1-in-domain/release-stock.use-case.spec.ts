import { Test } from "@nestjs/testing";
import { ReleaseStockUseCase } from "./release-stock.use-case";
import { StockReservationNotActiveError } from "@/product/domain/exceptions/product.exceptions";
import { StockReservationNotFoundError } from "@/product/application/product.application.exceptions";
import { StockReservation } from "@/product/domain/entities/stock-reservation.entity";
import { Product } from "@/product/domain/entities/product.entity";
import { v4 as uuidv4 } from "uuid";

jest.mock("@/product/infrastructure/persistence/product.repository");
jest.mock("@/product/infrastructure/persistence/stock-reservations.repository");
jest.mock("typeorm-transactional", () => ({
  Transactional: () => () => ({}),
}));

import { ProductRepository } from "@/product/infrastructure/persistence/product.repository";
import { StockReservationRepository } from "@/product/infrastructure/persistence/stock-reservations.repository";
import { ValidateStockService } from "@/product/domain/services/validate-stock.service";

describe("ReleaseStockUseCase", () => {
  let useCase: ReleaseStockUseCase;
  let productRepository: jest.Mocked<ProductRepository>;
  let stockReservationRepository: jest.Mocked<StockReservationRepository>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        ReleaseStockUseCase,
        ProductRepository,
        StockReservationRepository,
        ValidateStockService,
      ],
    }).compile();

    useCase = module.get<ReleaseStockUseCase>(ReleaseStockUseCase);
    productRepository =
      module.get<jest.Mocked<ProductRepository>>(ProductRepository);
    stockReservationRepository = module.get<
      jest.Mocked<StockReservationRepository>
    >(StockReservationRepository);
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
    [10, 2, 2, 10, "reservedStock와 예약 수량이 같을 때"],
    [10, 10, 10, 10, "전체 재고가 모두 예약된 상태에서 해제할 때"],
    [10, 1, 1, 10, "reservedStock이 1일 때"],
    [10, 5, 3, 8, "reservedStock이 예약 수량보다 클 때"],
    [1, 1, 1, 1, "재고가 1개일 때"],
  ];

  describe.each(testCases)(
    "재고 해제 성공 시 상품 및 예약 상태가 올바르게 변경되어야 한다",
    (
      totalStock,
      reservedStock,
      reservationQuantity,
      expectedAvailableStock,
      desc
    ) => {
      it(`${desc}`, async () => {
        const mockProduct = Product.create({
          name: "테스트 상품",
          description: "테스트 상품 설명",
          price: 1000,
          totalStock,
          reservedStock,
          isActive: true,
        });

        const mockStockReservation = StockReservation.create({
          productId: mockProduct.id,
          userId: uuidv4(),
          quantity: reservationQuantity,
          orderId: uuidv4(),
        });

        stockReservationRepository.findById.mockResolvedValue(
          mockStockReservation
        );
        productRepository.findById.mockResolvedValue(mockProduct);

        const result = await useCase.execute({
          stockReservationId: "reservation-1",
          orderId: mockStockReservation.orderId,
        });

        expect(mockStockReservation.isActive).toBe(false);
        expect(mockProduct.getAvailableStock()).toBe(expectedAvailableStock);
        expect(result).toEqual({
          stockReservation: mockStockReservation,
          product: mockProduct,
        });
      });
    }
  );

  it("존재하지 않는 재고 예약 ID로 요청시 에러가 발생해야 한다", async () => {
    stockReservationRepository.findById.mockResolvedValue(null);

    await expect(
      useCase.execute({
        stockReservationId: "non-existent",
        orderId: "non-existent",
      })
    ).rejects.toThrow(StockReservationNotFoundError);
  });

  it("이미 비활성화된 재고 예약으로 요청시 에러가 발생해야 한다", async () => {
    const inactiveReservation = StockReservation.create({
      productId: "product-1",
      userId: uuidv4(),
      quantity: 2,
      orderId: uuidv4(),
    });

    const mockProduct = Product.create({
      name: "테스트 상품",
      description: "테스트 상품 설명",
      price: 1000,
      totalStock: 10,
      reservedStock: 0,
      isActive: true,
    });

    stockReservationRepository.findById.mockResolvedValue(inactiveReservation);
    productRepository.findById.mockResolvedValue(mockProduct);

    inactiveReservation.releaseStock(inactiveReservation.orderId);

    await expect(
      useCase.execute({
        stockReservationId: "inactive-reservation",
        orderId: "inactive-reservation",
      })
    ).rejects.toThrow(StockReservationNotActiveError);
  });
});
