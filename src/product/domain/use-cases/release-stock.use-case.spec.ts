import { Test } from "@nestjs/testing";
import { ReleaseStockUseCase } from "./release-stock.use-case";
import {
  StockReservationNotFoundError,
  StockReservationNotActiveError,
} from "@/product/domain/exceptions/product.exceptions";
import { StockReservation } from "@/product/domain/entities/stock-reservation.entity";
import { Product } from "@/product/domain/entities/product.entity";
import { v4 as uuidv4 } from "uuid";

describe("ReleaseStockUseCase", () => {
  let useCase: ReleaseStockUseCase;
  let productRepository: any;
  let stockReservationRepository: any;

  beforeEach(async () => {
    productRepository = {
      findById: jest.fn(),
      save: jest.fn(),
    };

    stockReservationRepository = {
      findById: jest.fn(),
      save: jest.fn(),
    };

    const module = await Test.createTestingModule({
      providers: [
        ReleaseStockUseCase,
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

    useCase = module.get<ReleaseStockUseCase>(ReleaseStockUseCase);
  });

  // TODO: test each 유틸 함수 만들면 예쁘게 리팩토링 가능할듯함.
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
        });

        stockReservationRepository.findById.mockResolvedValue(
          mockStockReservation
        );
        productRepository.findById.mockResolvedValue(mockProduct);

        const result = await useCase.execute({
          stockReservationId: "reservation-1",
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
      useCase.execute({ stockReservationId: "non-existent" })
    ).rejects.toThrow(StockReservationNotFoundError);
  });

  it("이미 비활성화된 재고 예약으로 요청시 에러가 발생해야 한다", async () => {
    const inactiveReservation = {
      productId: "product-1",
      quantity: 2,
      isActive: false,
    };

    stockReservationRepository.findById.mockResolvedValue(inactiveReservation);

    await expect(
      useCase.execute({ stockReservationId: "inactive-reservation" })
    ).rejects.toThrow(StockReservationNotActiveError);
  });
});
