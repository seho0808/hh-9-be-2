import { Injectable } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { OrderApplicationService } from "./order.service";
import { Order } from "../domain/entities/order.entitiy";
import { ProductApplicationService } from "@/product/application/services/product.service";
import { TransactionService } from "@/common/services/transaction.service";
import { FindStalePendingOrdersUseCase } from "./use-cases/tier-1-in-domain/find-stale-pending-orders.use-case";
import { FindFailedOrdersUseCase } from "./use-cases/tier-1-in-domain/find-failed-orders.use-case";
import { RecoverOrderUseCase } from "./use-cases/tier-2/recover-order.use-case";

@Injectable()
export class OrderRecoveryService {
  constructor(
    private readonly productApplicationService: ProductApplicationService,
    private readonly transactionService: TransactionService,
    private readonly findStalePendingOrdersUseCase: FindStalePendingOrdersUseCase,
    private readonly findFailedOrdersUseCase: FindFailedOrdersUseCase,
    private readonly recoverOrderUseCase: RecoverOrderUseCase
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async recoverStalePendingOrders(): Promise<void> {
    const stalePendingOrders = await this.findStalePendingOrdersUseCase.execute(
      {
        minutesThreshold: 10,
        limit: 50,
      }
    );

    if (stalePendingOrders.orders.length === 0) return;

    for (const order of stalePendingOrders.orders) {
      await this.recoverSingleOrder(order);
    }
  }

  @Cron(CronExpression.EVERY_10_MINUTES)
  async retryFailedOrders(): Promise<void> {
    const failedOrders = await this.findFailedOrdersUseCase.execute({
      limit: 20,
    });

    if (failedOrders.orders.length === 0) return;

    for (const order of failedOrders.orders) {
      await this.recoverSingleOrder(order);
    }
  }

  private async recoverSingleOrder(order: Order): Promise<void> {
    await this.transactionService.runWithTransaction(async (manager) => {
      const stockReservationIds = await this.getStockReservationIds(order);

      await this.recoverOrderUseCase.execute({
        order,
        couponId: order.appliedCouponId,
        stockReservationIds,
        idempotencyKey: order.idempotencyKey,
      });
    });
  }

  private async getStockReservationIds(order: Order): Promise<string[]> {
    const stockReservationIds =
      await this.productApplicationService.getStockReservationIdsByIdempotencyKey(
        order.idempotencyKey
      );

    return stockReservationIds;
  }
}
