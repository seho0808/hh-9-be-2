import { Injectable } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { Transactional } from "typeorm-transactional";
import { FindFailedOrdersUseCase } from "../tier-1-in-domain/find-failed-orders.use-case";
import { FindStalePendingOrdersUseCase } from "../tier-1-in-domain/find-stale-pending-orders.use-case";
import { GetStockReservationsByOrderIdUseCase } from "@/product/application/use-cases/tier-1-in-domain/get-stock-reservations-by-order-id.use-case";
import { RecoverOrderUseCase } from "../tier-2/recover-order.use-case";
import { Order } from "@/order/domain/entities/order.entitiy";

export interface AutoRecoverOrdersUseCaseResult {
  recoveredOrdersCount: number;
  failedRecoveries: string[];
}

@Injectable()
export class AutoRecoverOrdersUseCase {
  private isRecoveryRunning = false;

  private readonly FAILED_ORDERS_LIMIT = 50;
  private readonly STALE_ORDERS_LIMIT = 50;
  private readonly STALE_ORDER_THRESHOLD_MINUTES = 10;

  constructor(
    private readonly findFailedOrdersUseCase: FindFailedOrdersUseCase,
    private readonly findStalePendingOrdersUseCase: FindStalePendingOrdersUseCase,
    private readonly getStockReservationsByOrderIdUseCase: GetStockReservationsByOrderIdUseCase,
    private readonly recoverOrderUseCase: RecoverOrderUseCase
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async executeScheduledRecovery(): Promise<void> {
    if (this.isRecoveryRunning) return;

    try {
      const result = await this.execute();
      console.log(
        "Auto-recovery job completed: ",
        result.recoveredOrdersCount,
        "failed recoveries: ",
        result.failedRecoveries
      );
    } catch (error) {
      console.error("Auto-recovery job failed: ", error);
    }
  }

  @Transactional()
  private async execute(): Promise<AutoRecoverOrdersUseCaseResult> {
    if (this.isRecoveryRunning) {
      throw new Error("Auto-recovery is already running");
    }

    this.isRecoveryRunning = true;
    let recoveredOrdersCount = 0;
    const failedRecoveries: string[] = [];

    try {
      const failedOrdersResult = await this.findFailedOrdersUseCase.execute({
        limit: this.FAILED_ORDERS_LIMIT,
      });

      const stalePendingOrdersResult =
        await this.findStalePendingOrdersUseCase.execute({
          minutesThreshold: this.STALE_ORDER_THRESHOLD_MINUTES,
          limit: this.STALE_ORDERS_LIMIT,
        });

      const ordersToRecover = [
        ...failedOrdersResult.orders,
        ...stalePendingOrdersResult.orders,
      ];

      for (const order of ordersToRecover) {
        try {
          await this.recoverSingleOrder(order);
          recoveredOrdersCount++;
        } catch (error) {
          failedRecoveries.push(order.id);
        }
      }

      return {
        recoveredOrdersCount,
        failedRecoveries,
      };
    } finally {
      this.isRecoveryRunning = false;
    }
  }

  private async recoverSingleOrder(order: Order): Promise<void> {
    try {
      const stockReservationsResult =
        await this.getStockReservationsByOrderIdUseCase.execute({
          orderId: order.id,
        });

      const stockReservationIds = stockReservationsResult.stockReservations.map(
        (reservation) => reservation.id
      );

      await this.recoverOrderUseCase.execute({
        order,
        userCouponId: order.appliedUserCouponId,
        stockReservationIds,
        orderId: order.id,
      });
    } catch (error) {
      throw error;
    }
  }

  getRecoveryStatus(): { isRunning: boolean } {
    return { isRunning: this.isRecoveryRunning };
  }
}
