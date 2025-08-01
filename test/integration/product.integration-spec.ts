import { Test, TestingModule } from "@nestjs/testing";
import { DataSource, Repository } from "typeorm";
import { getRepositoryToken } from "@nestjs/typeorm";
import { TestContainersHelper } from "../testcontainers-helper";
import { ProductFactory } from "../../src/product/infrastructure/persistence/factories/product.factory";
import { StockReservationFactory } from "../../src/product/infrastructure/persistence/factories/stock-reservations.factory";
import { ProductTypeOrmEntity } from "../../src/product/infrastructure/persistence/orm/product.typeorm.entity";
import { StockReservationTypeOrmEntity } from "../../src/product/infrastructure/persistence/orm/stock-reservations.typeorm.entity";
import { ReserveStockUseCase } from "../../src/product/application/use-cases/tier-1-in-domain/reserve-stock.use-case";
import { ReleaseStockUseCase } from "../../src/product/application/use-cases/tier-1-in-domain/release-stock.use-case";
import { ConfirmStockUseCase } from "../../src/product/application/use-cases/tier-1-in-domain/confirm-stock.use-case";
import { ReserveStocksUseCase } from "../../src/product/application/use-cases/tier-2/reserve-stocks.use-case";
import { ProductNotFoundError } from "../../src/product/domain/exceptions/product.exceptions";
import { InsufficientStockError } from "../../src/product/domain/exceptions/product.exceptions";
import { ProductRepository } from "../../src/product/infrastructure/persistence/product.repository";
import { StockReservationRepository } from "../../src/product/infrastructure/persistence/stock-reservations.repository";
import { ValidateStockService } from "../../src/product/domain/services/validate-stock.service";

describe("Product Domain Integration Tests", () => {
  let testHelper: TestContainersHelper;
  let dataSource: DataSource;
  let productRepository: Repository<ProductTypeOrmEntity>;
  let stockReservationRepository: Repository<StockReservationTypeOrmEntity>;
  let reserveStockUseCase: ReserveStockUseCase;
  let releaseStockUseCase: ReleaseStockUseCase;
  let confirmStockUseCase: ConfirmStockUseCase;
  let reserveStocksUseCase: ReserveStocksUseCase;

  beforeAll(async () => {
    testHelper = new TestContainersHelper();
    const setup = await testHelper.setupDatabaseOnly();
    dataSource = setup.dataSource;

    productRepository = dataSource.getRepository(ProductTypeOrmEntity);
    stockReservationRepository = dataSource.getRepository(
      StockReservationTypeOrmEntity
    );

    const moduleFixture: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: getRepositoryToken(ProductTypeOrmEntity),
          useValue: productRepository,
        },
        {
          provide: getRepositoryToken(StockReservationTypeOrmEntity),
          useValue: stockReservationRepository,
        },
        ProductRepository,
        StockReservationRepository,
        ValidateStockService,
        ReserveStockUseCase,
        ReleaseStockUseCase,
        ConfirmStockUseCase,
        ReserveStocksUseCase,
      ],
    }).compile();

    reserveStockUseCase =
      moduleFixture.get<ReserveStockUseCase>(ReserveStockUseCase);
    releaseStockUseCase =
      moduleFixture.get<ReleaseStockUseCase>(ReleaseStockUseCase);
    confirmStockUseCase =
      moduleFixture.get<ConfirmStockUseCase>(ConfirmStockUseCase);
    reserveStocksUseCase =
      moduleFixture.get<ReserveStocksUseCase>(ReserveStocksUseCase);
  });

  afterAll(async () => {
    await testHelper.cleanup();
  });

  beforeEach(async () => {
    await testHelper.clearDatabase(dataSource);
    await testHelper.createTestUser(dataSource);
    ProductFactory.resetCounter();
    StockReservationFactory.resetCounter();
  });

  describe("ReserveStockUseCase (@Transactional)", () => {
    it("재고 예약이 성공적으로 처리되어야 함", async () => {
      // Given: 충분한 재고를 가진 상품
      const product = await ProductFactory.createAndSave(productRepository, {
        totalStock: 100,
        reservedStock: 10,
      });

      // When: 재고를 예약
      const command = {
        productId: product.id,
        userId: "user-123",
        quantity: 5,
        orderId: "order-1",
      };

      const result = await reserveStockUseCase.execute(command);

      // Then: 재고 예약이 생성되고 상품의 예약 재고가 증가해야 함
      expect(result.stockReservation.productId).toBe(product.id);
      expect(result.stockReservation.userId).toBe("user-123");
      expect(result.stockReservation.quantity).toBe(5);
      expect(result.product.reservedStock).toBe(15); // 10 + 5

      // DB 검증
      const savedProduct = await productRepository.findOne({
        where: { id: product.id },
      });
      expect(savedProduct.reservedStock).toBe(15);

      const savedReservation = await stockReservationRepository.findOne({
        where: { orderId: "order-1" },
      });
      expect(savedReservation).toBeDefined();
      expect(savedReservation.isActive).toBe(true);
    });

    it("재고가 부족할 때 예외가 발생해야 함", async () => {
      // Given: 재고가 부족한 상품
      const product = await ProductFactory.createAndSave(productRepository, {
        totalStock: 10,
        reservedStock: 8,
      });

      // When & Then: 재고 부족으로 예외 발생
      const command = {
        productId: product.id,
        userId: "user-123",
        quantity: 5, // 가용 재고(2)보다 많은 수량
        orderId: "order-2",
      };

      await expect(reserveStockUseCase.execute(command)).rejects.toThrow(
        InsufficientStockError
      );

      // DB 롤백 검증
      const savedProduct = await productRepository.findOne({
        where: { id: product.id },
      });
      expect(savedProduct.reservedStock).toBe(8); // 변경되지 않음
    });

    it("존재하지 않는 상품에 대해 예외가 발생해야 함", async () => {
      // Given: 존재하지 않는 상품 ID

      // When & Then: 상품을 찾을 수 없음으로 예외 발생
      const command = {
        productId: "non-existent-product",
        userId: "user-123",
        quantity: 5,
        orderId: "order-3",
      };

      await expect(reserveStockUseCase.execute(command)).rejects.toThrow(
        ProductNotFoundError
      );
    });
  });

  describe("ReleaseStockUseCase (@Transactional)", () => {
    it("재고 해제가 성공적으로 처리되어야 함", async () => {
      // Given: 예약된 재고가 있는 상품과 예약 건
      const product = await ProductFactory.createAndSave(productRepository, {
        totalStock: 100,
        reservedStock: 15,
      });

      const stockReservation = await StockReservationFactory.createAndSave(
        stockReservationRepository,
        {
          productId: product.id,
          userId: "user-123",
          quantity: 5,
          isActive: true,
        }
      );

      // When: 재고를 해제
      const command = {
        stockReservationId: stockReservation.id,
        orderId: stockReservation.orderId,
      };

      const result = await releaseStockUseCase.execute(command);

      // Then: 예약이 비활성화되고 상품의 예약 재고가 감소해야 함
      expect(result.stockReservation.isActive).toBe(false);
      expect(result.product.reservedStock).toBe(10); // 15 - 5

      // DB 검증
      const savedProduct = await productRepository.findOne({
        where: { id: product.id },
      });
      expect(savedProduct.reservedStock).toBe(10);

      const savedReservation = await stockReservationRepository.findOne({
        where: { orderId: stockReservation.orderId },
      });
      expect(savedReservation.isActive).toBe(false);
    });

    it("이미 해제된 재고에 대해 중복 해제가 방지되어야 함", async () => {
      // Given: 이미 해제된 재고 예약
      const product = await ProductFactory.createAndSave(productRepository, {
        totalStock: 100,
        reservedStock: 10,
      });

      const stockReservation = await StockReservationFactory.createAndSave(
        stockReservationRepository,
        {
          productId: product.id,
          userId: "user-123",
          quantity: 5,
          isActive: false, // 이미 해제됨
        }
      );

      // When: 재고를 다시 해제 시도
      const command = {
        stockReservationId: stockReservation.id,
        orderId: stockReservation.orderId,
      };

      // Then: 중복 처리 방지를 위해 예외가 발생하거나 무시되어야 함
      await expect(releaseStockUseCase.execute(command)).rejects.toThrow();
    });
  });

  describe("ConfirmStockUseCase (@Transactional)", () => {
    it("재고 확정이 성공적으로 처리되어야 함", async () => {
      // Given: 예약된 재고가 있는 상품과 예약 건
      const product = await ProductFactory.createAndSave(productRepository, {
        totalStock: 100,
        reservedStock: 15,
      });

      const stockReservation = await StockReservationFactory.createAndSave(
        stockReservationRepository,
        {
          productId: product.id,
          userId: "user-123",
          quantity: 5,
          isActive: true,
        }
      );

      // When: 재고를 확정
      const command = {
        stockReservationId: stockReservation.id,
        orderId: stockReservation.orderId,
      };

      const result = await confirmStockUseCase.execute(command);

      // Then: 예약이 비활성화되고 상품의 총 재고와 예약 재고가 모두 감소해야 함
      expect(result.stockReservation.isActive).toBe(false);
      expect(result.product.totalStock).toBe(95); // 100 - 5
      expect(result.product.reservedStock).toBe(10); // 15 - 5

      // DB 검증
      const savedProduct = await productRepository.findOne({
        where: { id: product.id },
      });
      expect(savedProduct.totalStock).toBe(95);
      expect(savedProduct.reservedStock).toBe(10);

      const savedReservation = await stockReservationRepository.findOne({
        where: { orderId: stockReservation.orderId },
      });
      expect(savedReservation.isActive).toBe(false);
    });
  });

  describe("ReserveStocksUseCase (@Transactional) - Tier 2", () => {
    it("여러 상품의 재고를 동시에 예약할 수 있어야 함", async () => {
      // Given: 여러 상품들
      const product1 = await ProductFactory.createAndSave(productRepository, {
        totalStock: 50,
        reservedStock: 5,
      });
      const product2 = await ProductFactory.createAndSave(productRepository, {
        totalStock: 30,
        reservedStock: 10,
      });

      // When: 여러 상품의 재고를 동시에 예약
      const command = {
        requests: [
          {
            productId: product1.id,
            userId: "user-123",
            quantity: 10,
            orderId: "batch-reserve-1",
          },
          {
            productId: product2.id,
            userId: "user-123",
            quantity: 5,
            orderId: "batch-reserve-2",
          },
        ],
      };

      const result = await reserveStocksUseCase.execute(command);

      // Then: 모든 예약이 성공해야 함
      expect(result.result).toHaveLength(2);
      expect(result.result[0].stockReservation.quantity).toBe(10);
      expect(result.result[1].stockReservation.quantity).toBe(5);

      // DB 검증
      const savedProduct1 = await productRepository.findOne({
        where: { id: product1.id },
      });
      const savedProduct2 = await productRepository.findOne({
        where: { id: product2.id },
      });

      expect(savedProduct1.reservedStock).toBe(15); // 5 + 10
      expect(savedProduct2.reservedStock).toBe(15); // 10 + 5
    });

    it("일부 상품의 재고가 부족할 때 전체 트랜잭션이 롤백되어야 함", async () => {
      // Given: 재고가 충분한 상품과 부족한 상품
      const product1 = await ProductFactory.createAndSave(productRepository, {
        totalStock: 50,
        reservedStock: 5,
      });
      const product2 = await ProductFactory.createAndSave(productRepository, {
        totalStock: 10,
        reservedStock: 8, // 가용 재고 2개만 남음
      });

      // When: 여러 상품의 재고를 동시에 예약 (하나는 재고 부족)
      const command = {
        requests: [
          {
            productId: product1.id,
            userId: "user-123",
            quantity: 10,
            orderId: "batch-reserve-fail-1",
          },
          {
            productId: product2.id,
            userId: "user-123",
            quantity: 5, // 가용 재고(2)보다 많음
            orderId: "batch-reserve-fail-2",
          },
        ],
      };

      // Then: 전체 트랜잭션이 실패해야 함
      await expect(reserveStocksUseCase.execute(command)).rejects.toThrow();

      // DB 롤백 검증 - 모든 변경사항이 롤백되어야 함
      const savedProduct1 = await productRepository.findOne({
        where: { id: product1.id },
      });
      const savedProduct2 = await productRepository.findOne({
        where: { id: product2.id },
      });

      expect(savedProduct1.reservedStock).toBe(5); // 변경되지 않음
      expect(savedProduct2.reservedStock).toBe(8); // 변경되지 않음

      // 예약 건들이 생성되지 않았는지 확인
      const reservations = await stockReservationRepository.find({
        where: [
          { orderId: "batch-reserve-fail-1" },
          { orderId: "batch-reserve-fail-2" },
        ],
      });
      expect(reservations).toHaveLength(0);
    });
  });
});
