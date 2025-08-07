import { Test, TestingModule } from "@nestjs/testing";
import { DataSource, Repository } from "typeorm";
import { getRepositoryToken } from "@nestjs/typeorm";
import { TestContainersHelper } from "../../testcontainers-helper";
import { ProductFactory } from "@/product/infrastructure/persistence/factories/product.factory";
import { StockReservationFactory } from "@/product/infrastructure/persistence/factories/stock-reservations.factory";
import { ProductTypeOrmEntity } from "@/product/infrastructure/persistence/orm/product.typeorm.entity";
import { StockReservationTypeOrmEntity } from "@/product/infrastructure/persistence/orm/stock-reservations.typeorm.entity";
import { StockReservationStatus } from "@/product/domain/entities/stock-reservation.entity";
import { ReserveStockUseCase } from "@/product/application/use-cases/tier-1-in-domain/reserve-stock.use-case";
import { ReleaseStockUseCase } from "@/product/application/use-cases/tier-1-in-domain/release-stock.use-case";
import { ConfirmStockUseCase } from "@/product/application/use-cases/tier-1-in-domain/confirm-stock.use-case";
import { ProductRepository } from "@/product/infrastructure/persistence/product.repository";
import { StockReservationRepository } from "@/product/infrastructure/persistence/stock-reservations.repository";
import { ValidateStockService } from "@/product/domain/services/validate-stock.service";

describe("Product Stock Concurrency Tests", () => {
  let testHelper: TestContainersHelper;
  let dataSource: DataSource;
  let productRepository: Repository<ProductTypeOrmEntity>;
  let stockReservationRepository: Repository<StockReservationTypeOrmEntity>;
  let reserveStockUseCase: ReserveStockUseCase;
  let releaseStockUseCase: ReleaseStockUseCase;
  let confirmStockUseCase: ConfirmStockUseCase;

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
      ],
    }).compile();

    reserveStockUseCase =
      moduleFixture.get<ReserveStockUseCase>(ReserveStockUseCase);
    releaseStockUseCase =
      moduleFixture.get<ReleaseStockUseCase>(ReleaseStockUseCase);
    confirmStockUseCase =
      moduleFixture.get<ConfirmStockUseCase>(ConfirmStockUseCase);
  });

  afterAll(async () => {
    await testHelper.cleanup();
  });

  beforeEach(async () => {
    await testHelper.clearDatabase(dataSource);
    await testHelper.createTestUser(dataSource);

    // Reset factory counters
    ProductFactory.resetCounter();
    StockReservationFactory.resetCounter();
  });

  describe("재고 예약 동시성 테스트", () => {
    it("제한된 재고에 대한 동시 예약 시 정확한 수량만 성공해야 함", async () => {
      // Given: 총 재고 10개인 상품
      const totalStock = 10;
      const product = await ProductFactory.createAndSave(productRepository, {
        name: "Limited Stock Product",
        price: 10000,
        totalStock: totalStock,
        reservedStock: 0,
        isActive: true,
      });

      const reserveQuantity = 2;
      const concurrentRequests = 8; // 2개씩 8번 = 16개 요청 (10개 재고 초과)

      // When: 동시에 여러 재고 예약 시도
      const reservePromises = Array.from(
        { length: concurrentRequests },
        (_, i) =>
          reserveStockUseCase
            .execute({
              productId: product.id,
              userId: "user-123",
              quantity: reserveQuantity,
              orderId: `concurrent-order-${i}`,
            })
            .catch((error) => ({ error }))
      );

      const results = await Promise.all(reservePromises);

      // Then: 재고 한도 내에서만 성공해야 함
      const successes = results.filter((result) => !("error" in result));
      const failures = results.filter((result) => "error" in result);

      const maxPossibleReservations = Math.floor(totalStock / reserveQuantity); // 5개
      expect(successes.length).toBe(maxPossibleReservations);
      expect(failures.length).toBe(
        concurrentRequests - maxPossibleReservations
      );

      // DB 검증: 상품의 예약 재고
      const updatedProduct = await productRepository.findOne({
        where: { id: product.id },
      });
      expect(updatedProduct.reservedStock).toBe(
        maxPossibleReservations * reserveQuantity
      );

      // DB 검증: 예약 기록
      const reservations = await stockReservationRepository.find({
        where: { productId: product.id },
      });
      expect(reservations).toHaveLength(maxPossibleReservations);
    });

    it("재고가 부족한 상품에 동시 예약 시도 시 모두 실패해야 함", async () => {
      // Given: 이미 모든 재고가 예약된 상품
      const product = await ProductFactory.createAndSave(productRepository, {
        name: "Out of Stock Product",
        price: 10000,
        totalStock: 5,
        reservedStock: 5, // 이미 모든 재고가 예약됨
        isActive: true,
      });

      const concurrentRequests = 5;

      // When: 동시에 재고 예약 시도
      const reservePromises = Array.from(
        { length: concurrentRequests },
        (_, i) =>
          reserveStockUseCase
            .execute({
              productId: product.id,
              userId: "user-123",
              quantity: 1,
              orderId: `no-stock-order-${i}`,
            })
            .catch((error) => ({ error }))
      );

      const results = await Promise.all(reservePromises);

      // Then: 모든 요청이 실패해야 함
      const failures = results.filter((result) => "error" in result);
      expect(failures.length).toBe(concurrentRequests);

      // DB 검증: 예약 재고가 변경되지 않음
      const updatedProduct = await productRepository.findOne({
        where: { id: product.id },
      });
      expect(updatedProduct.reservedStock).toBe(5);
    });
  });

  describe("재고 예약 해제 동시성 테스트", () => {
    it("동시 재고 예약 해제 시 모든 예약이 정확히 해제되어야 함", async () => {
      // Given: 예약된 재고가 있는 상품
      const product = await ProductFactory.createAndSave(productRepository, {
        name: "Reserved Stock Product",
        price: 10000,
        totalStock: 20,
        reservedStock: 10,
        isActive: true,
      });

      // 여러 예약 기록 생성
      const reservationCount = 5;
      const reservations = [];
      for (let i = 0; i < reservationCount; i++) {
        const reservation = await StockReservationFactory.createAndSave(
          stockReservationRepository,
          {
            productId: product.id,
            userId: "user-123",
            quantity: 2,
            orderId: `release-order-${i}`,
            status: StockReservationStatus.RESERVED,
          }
        );
        reservations.push(reservation);
      }

      // When: 동시에 모든 예약 해제
      const releasePromises = reservations.map((reservation) =>
        releaseStockUseCase.execute({
          stockReservationId: reservation.id,
          orderId: reservation.orderId,
        })
      );

      const results = await Promise.all(releasePromises);

      // Then: 모든 해제가 성공해야 함
      expect(results).toHaveLength(reservationCount);
      results.forEach((result) => {
        expect(result.product.id).toBe(product.id);
        expect(result.stockReservation.status).toBe(
          StockReservationStatus.RELEASED
        );
      });

      // DB 검증: 예약 재고가 모두 해제됨
      const updatedProduct = await productRepository.findOne({
        where: { id: product.id },
      });
      expect(updatedProduct.reservedStock).toBe(0);

      // DB 검증: 모든 예약이 RELEASED 상태
      const updatedReservations = await stockReservationRepository.find({
        where: { productId: product.id },
      });
      expect(updatedReservations).toHaveLength(reservationCount);
      expect(
        updatedReservations.every(
          (r) => r.status === StockReservationStatus.RELEASED
        )
      ).toBe(true);
    });
  });

  describe("재고 예약 확정 동시성 테스트", () => {
    it("동시 재고 예약 확정 시 총 재고가 정확히 차감되어야 함", async () => {
      // Given: 예약된 재고가 있는 상품
      const product = await ProductFactory.createAndSave(productRepository, {
        name: "Confirm Stock Product",
        price: 10000,
        totalStock: 20,
        reservedStock: 8,
        isActive: true,
      });

      // 여러 예약 기록 생성
      const reservationCount = 4;
      const reservations = [];
      for (let i = 0; i < reservationCount; i++) {
        const reservation = await StockReservationFactory.createAndSave(
          stockReservationRepository,
          {
            productId: product.id,
            userId: "user-123",
            quantity: 2,
            orderId: `confirm-order-${i}`,
            status: StockReservationStatus.RESERVED,
          }
        );
        reservations.push(reservation);
      }

      // When: 동시에 모든 예약 확정
      const confirmPromises = reservations.map((reservation) =>
        confirmStockUseCase.execute({
          stockReservationId: reservation.id,
          orderId: reservation.orderId,
        })
      );

      const results = await Promise.all(confirmPromises);

      // Then: 모든 확정이 성공해야 함
      expect(results).toHaveLength(reservationCount);
      results.forEach((result) => {
        expect(result.product.id).toBe(product.id);
        expect(result.stockReservation.status).toBe(
          StockReservationStatus.CONFIRMED
        );
      });

      // DB 검증: 총 재고와 예약 재고가 정확히 조정됨
      const updatedProduct = await productRepository.findOne({
        where: { id: product.id },
      });
      expect(updatedProduct.totalStock).toBe(12); // 20 - 8 = 12
      expect(updatedProduct.reservedStock).toBe(0);

      // DB 검증: 모든 예약이 CONFIRMED 상태
      const updatedReservations = await stockReservationRepository.find({
        where: { productId: product.id },
      });
      expect(updatedReservations).toHaveLength(reservationCount);
      expect(
        updatedReservations.every(
          (r) => r.status === StockReservationStatus.CONFIRMED
        )
      ).toBe(true);
    });
  });

  describe("재고 예약, 해제, 확정 혼합 동시성 테스트", () => {
    it("예약, 해제, 확정 트랜잭션이 동시에 일어날 때 정확히 처리되어야 함", async () => {
      // Given: 충분한 재고를 가진 상품
      const product = await ProductFactory.createAndSave(productRepository, {
        name: "Mixed Operations Product",
        price: 10000,
        totalStock: 50,
        reservedStock: 0,
        isActive: true,
      });

      // 먼저 기존 예약들 생성
      const existingReservation1 = await StockReservationFactory.createAndSave(
        stockReservationRepository,
        {
          productId: product.id,
          userId: "user-123",
          quantity: 3,
          orderId: "existing-order-1",
          status: StockReservationStatus.RESERVED,
        }
      );

      const existingReservation2 = await StockReservationFactory.createAndSave(
        stockReservationRepository,
        {
          productId: product.id,
          userId: "user-123",
          quantity: 2,
          orderId: "existing-order-2",
          status: StockReservationStatus.RESERVED,
        }
      );

      // 상품의 예약 재고 업데이트
      await productRepository.update(product.id, { reservedStock: 5 });

      // When: 다양한 트랜잭션을 동시에 실행
      const operations = [
        // 새로운 예약
        reserveStockUseCase.execute({
          productId: product.id,
          userId: "user-123",
          quantity: 4,
          orderId: "new-order-1",
        }),
        // 기존 예약 해제
        releaseStockUseCase.execute({
          stockReservationId: existingReservation1.id,
          orderId: existingReservation1.orderId,
        }),
        // 기존 예약 확정
        confirmStockUseCase.execute({
          stockReservationId: existingReservation2.id,
          orderId: existingReservation2.orderId,
        }),
      ];

      const results = await Promise.all(operations);

      // Then: 모든 작업이 성공해야 함
      expect(results).toHaveLength(3);

      // 최종 상태 검증
      const finalProduct = await productRepository.findOne({
        where: { id: product.id },
      });

      // 예상 상태:
      // - 초기 예약 5개 (3개 + 2개)
      // - 새 예약 +4개
      // - 해제 -3개
      // - 확정 -2개 (총재고에서도 -2)
      // 최종: 예약재고 4개 (5 + 4 - 3 - 2), 총재고 48개 (50 - 2)
      expect(finalProduct.reservedStock).toBe(4);
      expect(finalProduct.totalStock).toBe(48);

      // 예약 기록 검증
      const finalReservations = await stockReservationRepository.find({
        where: { productId: product.id },
      });
      expect(finalReservations).toHaveLength(3); // 기존 2개 + 새로운 1개

      const reservedCount = finalReservations.filter(
        (r) => r.status === StockReservationStatus.RESERVED
      ).length;
      const releasedCount = finalReservations.filter(
        (r) => r.status === StockReservationStatus.RELEASED
      ).length;
      const confirmedCount = finalReservations.filter(
        (r) => r.status === StockReservationStatus.CONFIRMED
      ).length;

      expect(reservedCount).toBe(1); // 새로운 예약
      expect(releasedCount).toBe(1); // 해제된 예약
      expect(confirmedCount).toBe(1); // 확정된 예약
    });
  });
});
