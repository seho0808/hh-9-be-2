import { Injectable } from "@nestjs/common";
import { RecoverUserCouponUseCase } from "@/coupon/application/use-cases/tier-1-in-domain/recover-user-coupon.use-case";
import { Order, OrderStatus } from "@/order/domain/entities/order.entitiy";
import { ReleaseStockUseCase } from "@/product/application/use-cases/tier-1-in-domain/release-stock.use-case";
import { RecoverPointsUseCase } from "@/wallet/application/use-cases/tier-1-in-domain/recover-points.use-case";
import { ChangeOrderStatusUseCase } from "../tier-1-in-domain/change-order-status.use-case";
import { Transactional } from "typeorm-transactional";
import { RetryOnOptimisticLock } from "@/common/decorators/retry-on-optimistic-lock.decorator";

export interface RecoverOrderCommand {
  order: Order;
  userCouponId: string | null;
  stockReservationIds: string[];
  orderId: string;
}

export interface RecoverOrderResult {
  order: Order;
}

@Injectable()
export class RecoverOrderUseCase {
  constructor(
    private readonly releaseStockUseCase: ReleaseStockUseCase,
    private readonly recoverUserCouponUseCase: RecoverUserCouponUseCase,
    private readonly recoverPointsUseCase: RecoverPointsUseCase,
    private readonly changeOrderStatusUseCase: ChangeOrderStatusUseCase
  ) {}

  @RetryOnOptimisticLock(5, 50)
  @Transactional()
  async execute(command: RecoverOrderCommand) {
    const { order, userCouponId, stockReservationIds, orderId } = command;

    await Promise.all(
      stockReservationIds.map((stockReservationId) =>
        this.releaseStockUseCase.execute({
          stockReservationId,
          orderId,
        })
      )
    );

    if (userCouponId) {
      await this.recoverUserCouponUseCase.execute({
        userCouponId,
        orderId,
      });
    }

    try {
      await this.recoverPointsUseCase.execute({
        userId: order.userId,
        amount: order.finalPrice,
        refId: orderId,
      });
    } catch (error) {
      if (error.code !== "POINT_TRANSACTION_NOT_FOUND") {
        throw error;
      }
    }

    const { order: changedOrder } = await this.changeOrderStatusUseCase.execute(
      {
        orderId: order.id,
        status: OrderStatus.FAILED,
      }
    );

    return {
      order: changedOrder,
    };
  }
}
