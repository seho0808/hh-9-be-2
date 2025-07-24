import { Injectable, Inject } from "@nestjs/common";
import { EntityManager } from "typeorm";
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
import { FindStalePendingOrdersUseCase } from "../domain/use-cases/find-stale-pending-orders.use-case";
import { FindFailedOrdersUseCase } from "../domain/use-cases/find-failed-orders.use-case";
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
    // Remove repository dependencies - they're now auto-managed by TransactionContext
    private readonly couponApplicationService: CouponApplicationService,
    private readonly productApplicationService: ProductApplicationService,
    private readonly walletApplicationService: WalletApplicationService,
    private readonly createOrderUseCase: CreateOrderUseCase,
    private readonly changeOrderStatusUseCase: ChangeOrderStatusUseCase,
    private readonly applyDiscountUseCase: ApplyDiscountUseCase,
    private readonly getOrderByIdUseCase: GetOrderByIdUseCase,
    private readonly getOrderByUserIdUseCase: GetOrderByUserIdUseCase,
    private readonly findStalePendingOrdersUseCase: FindStalePendingOrdersUseCase,
    private readonly findFailedOrdersUseCase: FindFailedOrdersUseCase
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
    const { order } = await this.transactionService.runWithTransaction(
      async (manager) => {
        return await this.createOrderUseCase.execute({
          userId,
          idempotencyKey,
          items,
        });
      }
    );

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
    await this.transactionService.runWithTransaction(async (manager) => {
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
    const successOrder = await this.transactionService.runWithTransaction(
      async (manager) => {
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
          // TODO: 한 번의 쿼리로 변경되도록 use-case 수정 필요함.
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
      }
    );

    return { order: successOrder };
  }

  // TODO: cronjob으로도 지속적으로 최근 Order들에 대해 다시 호출 해야함.
  async recoverOrder({
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
    await this.transactionService.runWithTransaction(async (manager) => {
      // 재고 예약 취소
      // TODO: 한 번의 쿼리로 변경되도록 use-case 수정 필요함.
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
    return await this.transactionService.runWithTransaction(async (manager) => {
      return await this.getOrderByIdUseCase.execute(orderId);
    });
  }

  async getOrdersByUserId(userId: string): Promise<Order[]> {
    return await this.transactionService.runWithTransaction(async (manager) => {
      return await this.getOrderByUserIdUseCase.execute(userId);
    });
  }

  async findStalePendingOrders(
    minutesThreshold: number,
    limit: number
  ): Promise<Order[]> {
    return await this.transactionService.runWithTransaction(async (manager) => {
      return (
        await this.findStalePendingOrdersUseCase.execute({
          minutesThreshold,
          limit,
        })
      ).orders;
    });
  }

  async findFailedOrders(limit: number): Promise<Order[]> {
    return await this.transactionService.runWithTransaction(async (manager) => {
      return (await this.findFailedOrdersUseCase.execute({ limit })).orders;
    });
  }
}
