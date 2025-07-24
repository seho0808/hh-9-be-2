import { Injectable, Inject } from "@nestjs/common";
import { DataSource, EntityManager } from "typeorm";
import { WalletApplicationService } from "@/wallet/application/wallet.service";
import { Order, OrderStatus } from "../domain/entities/order.entitiy";
import { ApplyDiscountUseCase } from "../domain/use-cases/apply-discount.use-case";
import { ChangeOrderStatusUseCase } from "../domain/use-cases/change-order-status.use-case";
import { CreateOrderUseCase } from "../domain/use-cases/create-order.use-case";
import { ProductApplicationService } from "@/product/application/services/product.service";
import { CouponApplicationService } from "@/coupon/application/services/coupon.service";
import {
  InsufficientPointBalanceError,
  InvalidCouponError,
} from "./order.exceptions";
import { GetOrderByIdUseCase } from "../domain/use-cases/get-order-by-id.use-case";
import { GetOrderByUserIdUseCase } from "../domain/use-cases/get-order-by-user-id.use-case";
import { OrderRepository } from "../infrastructure/persistence/order.repository";
import { OrderItemRepository } from "../infrastructure/persistence/order-item.repository";

import { CouponRepository } from "@/coupon/infrastructure/persistence/coupon.repository";
import { UserCouponRepository } from "@/coupon/infrastructure/persistence/user-coupon.repository";
import { ProductRepository } from "@/product/infrastructure/persistence/product.repository";
import { StockReservationRepository } from "@/product/infrastructure/persistence/stock-reservations.repository";
import { UserBalanceRepository } from "@/wallet/infrastructure/persistence/use-balance.repository";
import { PointTransactionRepository } from "@/wallet/infrastructure/persistence/point-transaction.repository";
import { TransactionService } from "@/common/services/transaction.service";

export interface PlaceOrderCommand {
  userId: string;
  couponId: string | null;
  idempotencyKey: string;
  itemsWithoutPrices: { productId: string; quantity: number }[];
}

export interface PlaceOrderResult {
  order: Order;
}

@Injectable()
export class OrderApplicationService {
  constructor(
    private readonly transactionService: TransactionService,
    @Inject("OrderRepositoryInterface")
    private readonly orderRepository: OrderRepository,
    @Inject("OrderItemRepositoryInterface")
    private readonly orderItemRepository: OrderItemRepository,
    // Inject all repositories for transaction scope
    @Inject("CouponRepositoryInterface")
    private readonly couponRepository: CouponRepository,
    @Inject("UserCouponRepositoryInterface")
    private readonly userCouponRepository: UserCouponRepository,
    @Inject("ProductRepositoryInterface")
    private readonly productRepository: ProductRepository,
    @Inject("StockReservationRepositoryInterface")
    private readonly stockReservationRepository: StockReservationRepository,
    @Inject("UserBalanceRepositoryInterface")
    private readonly userBalanceRepository: UserBalanceRepository,
    @Inject("PointTransactionRepositoryInterface")
    private readonly pointTransactionRepository: PointTransactionRepository,
    private readonly couponApplicationService: CouponApplicationService,
    private readonly productApplicationService: ProductApplicationService,
    private readonly walletApplicationService: WalletApplicationService,
    private readonly createOrderUseCase: CreateOrderUseCase,
    private readonly changeOrderStatusUseCase: ChangeOrderStatusUseCase,
    private readonly applyDiscountUseCase: ApplyDiscountUseCase,
    private readonly getOrderByIdUseCase: GetOrderByIdUseCase,
    private readonly getOrderByUserIdUseCase: GetOrderByUserIdUseCase
  ) {}

  async placeOrder(command: PlaceOrderCommand): Promise<PlaceOrderResult> {
    const { userId, couponId, idempotencyKey, itemsWithoutPrices } = command;

    const items = await this.getItemsWithPrices(itemsWithoutPrices);

    // 주문 생성 및 사전 검증
    const { order, discountPrice, discountedPrice, stockReservationIds } =
      await this.prepareOrder({ userId, couponId, items, idempotencyKey });

    try {
      // 쿠폰/잔고/재고 확정 적용
      return await this.processOrder({
        userId,
        couponId,
        order,
        discountPrice,
        discountedPrice,
        stockReservationIds,
        idempotencyKey,
      });
    } catch (error) {
      // 주문 복구
      await this.recoverOrder({
        order,
        couponId,
        stockReservationIds,
        idempotencyKey,
      });
      throw error;
    }
  }

  private async getItemsWithPrices(
    itemsWithoutPrices: { productId: string; quantity: number }[]
  ) {
    const products = await this.productApplicationService.getProductByIds(
      itemsWithoutPrices.map((item) => item.productId)
    );
    return itemsWithoutPrices.map((item) => ({
      ...item,
      unitPrice: products.find((p) => p.id === item.productId)?.price || 0,
    }));
  }

  private async prepareOrder({
    userId,
    couponId,
    items,
    idempotencyKey,
  }: {
    userId: string;
    couponId: string | null;
    items: { productId: string; unitPrice: number; quantity: number }[];
    idempotencyKey: string;
  }) {
    let discountPrice: number = 0;
    let discountedPrice: number = 0;
    let stockReservationIds: string[] = [];

    // 주문 생성
    const { order } = await this.executeInTransaction(async (manager) => {
      return await this.createOrderUseCase.execute({
        userId,
        idempotencyKey,
        items,
      });
    });

    // 쿠폰 확인
    if (couponId) {
      const validateResult =
        await this.couponApplicationService.validateUserCoupon(
          couponId,
          userId,
          order.totalPrice
        );
      discountPrice = validateResult.discountPrice;
      discountedPrice = validateResult.discountedPrice;

      if (!validateResult.isValid) {
        throw new InvalidCouponError(couponId);
      }
    }

    // 잔고 확인
    const walletValidationResult =
      await this.walletApplicationService.validateUsePoints(
        userId,
        order.finalPrice
      );
    if (!walletValidationResult.isValid) {
      throw new InsufficientPointBalanceError(userId, order.finalPrice);
    }

    // 재고 예약
    await this.executeInTransaction(async (manager) => {
      for (const item of items) {
        const { stockReservation } =
          await this.productApplicationService.reserveStock(
            {
              productId: item.productId,
              userId,
              quantity: item.quantity,
              idempotencyKey,
            },
            manager
          );
        stockReservationIds.push(stockReservation.id);
      }
    });

    return { order, discountPrice, discountedPrice, stockReservationIds };
  }

  private async processOrder({
    userId,
    couponId,
    order,
    discountPrice,
    discountedPrice,
    stockReservationIds,
    idempotencyKey,
  }: {
    userId: string;
    couponId: string | null;
    order: Order;
    discountPrice: number;
    discountedPrice: number;
    stockReservationIds: string[];
    idempotencyKey: string;
  }): Promise<{ order: Order }> {
    const successOrder = await this.executeInTransaction(async (manager) => {
      // 쿠폰 적용
      if (couponId) {
        const { order: discountedOrder } =
          await this.applyDiscountUseCase.execute({
            orderId: order.id,
            appliedCouponId: couponId,
            discountPrice,
            discountedPrice,
          });
        order = discountedOrder;

        await this.couponApplicationService.useUserCoupon(
          couponId,
          userId,
          order.id,
          order.totalPrice,
          idempotencyKey,
          manager
        );
      }

      // 잔고 사용
      const finalAmountToPay = order.finalPrice;
      await this.walletApplicationService.usePoints(
        userId,
        finalAmountToPay,
        idempotencyKey,
        manager
      );

      // 재고 확정
      await Promise.all(
        stockReservationIds.map((stockReservationId) =>
          this.productApplicationService.confirmStock(
            {
              stockReservationId,
              idempotencyKey,
            },
            manager
          )
        )
      );

      // 주문 상태 변경
      const { order: successOrder } =
        await this.changeOrderStatusUseCase.execute({
          orderId: order.id,
          status: OrderStatus.SUCCESS,
        });
      return successOrder;
    });

    return { order: successOrder };
  }

  // TODO: cronjob으로도 지속적으로 최근 Order들에 대해 다시 호출 해야함.
  private async recoverOrder({
    order,
    couponId,
    stockReservationIds,
    idempotencyKey,
  }: {
    order: Order;
    couponId: string | null;
    stockReservationIds: string[];
    idempotencyKey: string; // order idempotencyKey 기준으로 모두 처리
  }) {
    await this.executeInTransaction(async (manager) => {
      // 재고 예약 취소
      await Promise.all(
        stockReservationIds.map((stockReservationId) =>
          this.productApplicationService.releaseStock(
            {
              stockReservationId,
              idempotencyKey,
            },
            manager
          )
        )
      );

      // 쿠폰 해제
      if (couponId) {
        await this.couponApplicationService.recoverUserCoupon(
          couponId,
          idempotencyKey,
          manager
        );
      }

      // 잔고 복구
      await this.walletApplicationService.recoverPoints(
        order.userId,
        order.discountPrice,
        idempotencyKey,
        manager
      );

      // 주문 상태 변경
      await this.changeOrderStatusUseCase.execute({
        orderId: order.id,
        status: OrderStatus.FAILED,
      });
    });
  }

  async getOrderById(orderId: string): Promise<Order | null> {
    return await this.executeInTransaction(async (manager) => {
      return await this.getOrderByIdUseCase.execute(orderId);
    });
  }

  async getOrdersByUserId(userId: string): Promise<Order[]> {
    return await this.executeInTransaction(async (manager) => {
      return await this.getOrderByUserIdUseCase.execute(userId);
    });
  }

  private async executeInTransaction<T>(
    operation: (manager?: EntityManager) => Promise<T>,
    parentManager?: EntityManager
  ): Promise<T> {
    const repositories = [
      this.orderRepository,
      this.orderItemRepository,
      this.couponRepository,
      this.userCouponRepository,
      this.productRepository,
      this.stockReservationRepository,
      this.userBalanceRepository,
      this.pointTransactionRepository,
    ];

    return await this.transactionService.executeInTransaction(
      repositories,
      operation,
      parentManager
    );
  }
}
