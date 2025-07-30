import { Test } from "@nestjs/testing";
import { ConfirmStockUseCase } from "./confirm-stock.use-case";
import {
  StockReservationNotFoundError,
  StockReservationNotActiveError,
  StockReservationExpiredError,
} from "@/product/domain/exceptions/product.exceptions";
import { StockReservation } from "@/product/domain/entities/stock-reservation.entity";
import { Product } from "@/product/domain/entities/product.entity";
import { v4 as uuidv4 } from "uuid";
import { ValidateStockService } from "@/product/domain/services/validate-stock.service";

jest.mock("typeorm-transactional", () => ({
  Transactional: () => () => ({}),
}));

describe("ConfirmStockUseCase", () => {
  let useCase: ConfirmStockUseCase;
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
        ConfirmStockUseCase,
        ValidateStockService,
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

    useCase = module.get<ConfirmStockUseCase>(ConfirmStockUseCase);
  });

  it("재고 예약 확정이 성공적으로 처리되어야 한다", async () => {
    const mockProduct = Product.create({
      name: "테스트 상품",
      description: "테스트 상품 설명",
      price: 1000,
      totalStock: 10,
      reservedStock: 2,
      isActive: true,
    });

    const mockStockReservation = StockReservation.create({
      productId: mockProduct.id,
      userId: uuidv4(),
      quantity: 2,
      idempotencyKey: uuidv4(),
    });

    stockReservationRepository.findById.mockResolvedValue(mockStockReservation);
    productRepository.findById.mockResolvedValue(mockProduct);

    const result = await useCase.execute({
      stockReservationId: mockStockReservation.id,
      idempotencyKey: mockStockReservation.idempotencyKey,
    });

    expect(result.stockReservation.isActive).toBe(false);
    expect(result.product.getAvailableStock()).toBe(8);
  });

  it("존재하지 않는 재고 예약 ID로 요청시 에러가 발생해야 한다", async () => {
    stockReservationRepository.findById.mockResolvedValue(null);

    await expect(
      useCase.execute({
        stockReservationId: "non-existent",
        idempotencyKey: uuidv4(),
      })
    ).rejects.toThrow(StockReservationNotFoundError);
  });

  it("비활성화된 재고 예약으로 요청시 에러가 발생해야 한다", async () => {
    const mockStockReservation = StockReservation.create({
      productId: uuidv4(),
      userId: uuidv4(),
      quantity: 2,
      idempotencyKey: uuidv4(),
    });
    mockStockReservation.releaseStock(mockStockReservation.idempotencyKey);

    const mockProduct = Product.create({
      name: "테스트 상품",
      description: "테스트 상품 설명",
      price: 1000,
      totalStock: 10,
      reservedStock: 0,
      isActive: false,
    });

    productRepository.findById.mockResolvedValue(mockProduct);
    stockReservationRepository.findById.mockResolvedValue(mockStockReservation);

    await expect(
      useCase.execute({
        stockReservationId: mockStockReservation.id,
        idempotencyKey: mockStockReservation.idempotencyKey,
      })
    ).rejects.toThrow(StockReservationNotActiveError);
  });

  it("만료된 재고 예약으로 요청시 에러가 발생해야 한다", async () => {
    const mockStockReservation = StockReservation.create({
      productId: uuidv4(),
      userId: uuidv4(),
      quantity: 2,
      idempotencyKey: uuidv4(),
    });

    // 만료 시간을 과거로 설정하기 위해 fromPersistence 사용
    const pastDate = new Date();
    pastDate.setHours(pastDate.getHours() - 1);

    const expiredReservation = StockReservation.fromPersistence({
      ...mockStockReservation.toPersistence(),
      expiresAt: pastDate,
    });

    const mockProduct = Product.create({
      name: "테스트 상품",
      description: "테스트 상품 설명",
      price: 1000,
      totalStock: 10,
      reservedStock: 0,
      isActive: true,
    });

    stockReservationRepository.findById.mockResolvedValue(expiredReservation);
    productRepository.findById.mockResolvedValue(mockProduct);

    await expect(
      useCase.execute({
        stockReservationId: expiredReservation.id,
        idempotencyKey: expiredReservation.idempotencyKey,
      })
    ).rejects.toThrow(StockReservationExpiredError);
  });
});
