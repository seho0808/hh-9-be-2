import { INestApplication } from "@nestjs/common";
import * as request from "supertest";
import { DataSource, Repository } from "typeorm";
import {
  TestEnvironmentFactory,
  TestEnvironment,
} from "../test-environment/test-environment.factory";
import { CouponFactory } from "../../src/coupon/infrastructure/persistence/factories/coupon.factory";
import { CouponTypeOrmEntity } from "../../src/coupon/infrastructure/persistence/orm/coupon.typeorm.entity";
import { UserCouponTypeOrmEntity } from "../../src/coupon/infrastructure/persistence/orm/user-coupon.typeorm.entity";
import { CouponReservationTypeOrmEntity } from "../../src/coupon/infrastructure/persistence/orm/coupon-reservation.typeorm.entity";
import { CouponReservationStatus } from "../../src/coupon/domain/entities/coupon-reservation.entity";

describe("쿠폰 EDA E2E - 예약 -> 아웃박스 -> 카프카 -> 컨슈머 -> 발급", () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let couponRepository: Repository<CouponTypeOrmEntity>;
  let userCouponRepository: Repository<UserCouponTypeOrmEntity>;
  let reservationRepository: Repository<CouponReservationTypeOrmEntity>;
  let factory: TestEnvironmentFactory;
  let environment: TestEnvironment;

  beforeAll(async () => {
    factory = new TestEnvironmentFactory();
    environment = await factory.createAppWithDatabaseAndKafka();
    app = environment.app!;
    dataSource = environment.dataSource;
    couponRepository = dataSource.getRepository(CouponTypeOrmEntity);
    userCouponRepository = dataSource.getRepository(UserCouponTypeOrmEntity);
    reservationRepository = dataSource.getRepository(
      CouponReservationTypeOrmEntity
    );
  });

  afterAll(async () => {
    await factory.cleanup(environment);
  });

  beforeEach(async () => {
    await environment.dbHelper.clearDatabase();
    await environment.dataHelper.createTestUser();
  });

  it("쿠폰 예약 시 아웃박스 -> 카프카를 통해 발행되고 컨슈머를 통해 사용자 쿠폰이 발급된다", async () => {
    const authHeaders = await environment.dataHelper.getAuthHeaders();

    // Given: 쿠폰이 존재한다
    const coupon = await CouponFactory.createAndSave(couponRepository, {
      totalCount: 5,
      issuedCount: 0,
      discountType: "FIXED",
      discountValue: 1000,
      minimumOrderPrice: 0,
      couponCode: "EDA2024",
    });

    // When: 발급 예약 (202 Accepted)
    const reserveRes = await request(app.getHttpServer())
      .post(`/api/coupons/${coupon.id}/claims/reservations`)
      .set(authHeaders)
      .send({
        couponCode: "EDA2024",
        idempotencyKey: `idem-${Date.now()}`,
      })
      .expect(202);

    expect(reserveRes.body.success).toBe(true);
    const { reservationId } = reserveRes.body.data;
    expect(reservationId).toBeDefined();

    // Then: 최종적으로 reservation.status가 COMPLETED가 된다 (아웃박스 퍼블리셔와 카프카 컨슈머를 통해)
    const deadline = Date.now() + 20000; // 비동기 처리를 위해 최대 20초 대기
    let completed = false;
    while (Date.now() < deadline) {
      const reservation = await reservationRepository.findOne({
        where: { id: reservationId },
      });
      if (reservation?.status === CouponReservationStatus.COMPLETED) {
        completed = true;
        break;
      }
      await new Promise((r) => setTimeout(r, 500));
    }

    expect(completed).toBe(true);

    // And: 사용자에게 사용자 쿠폰이 발급됨
    const userCoupons = await userCouponRepository.find();
    expect(userCoupons.length).toBe(1);
    expect(userCoupons[0].couponId).toBe(coupon.id);
  });
});
