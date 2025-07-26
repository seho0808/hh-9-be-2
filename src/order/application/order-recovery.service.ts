import { Injectable } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { OrderApplicationService } from "./order.service";
import { Order } from "../domain/entities/order.entitiy";
import { ProductApplicationService } from "@/product/application/services/product.service";
import { TransactionService } from "@/common/services/transaction.service";

@Injectable()
export class OrderRecoveryService {
  constructor(
    private readonly orderApplicationService: OrderApplicationService,
    private readonly productApplicationService: ProductApplicationService,
    private readonly transactionService: TransactionService
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async recoverStalePendingOrders(): Promise<void> {
    const stalePendingOrders =
      await this.orderApplicationService.findStalePendingOrders(10, 50);

    if (stalePendingOrders.length === 0) return;

    for (const order of stalePendingOrders) {
      await this.recoverSingleOrder(order);
    }
  }

  @Cron(CronExpression.EVERY_10_MINUTES)
  async retryFailedOrders(): Promise<void> {
    const failedOrders =
      await this.orderApplicationService.findFailedOrders(20);

    if (failedOrders.length === 0) return;

    for (const order of failedOrders) {
      await this.recoverSingleOrder(order);
    }
  }

  private async recoverSingleOrder(order: Order): Promise<void> {
    await this.transactionService.runWithTransaction(async (manager) => {
      const stockReservationIds = await this.getStockReservationIds(order);

      await this.orderApplicationService.recoverOrder({
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
