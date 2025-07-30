import { Injectable } from "@nestjs/common";
import { RecoverUserCouponUseCase } from "@/coupon/application/use-cases/tier-1-in-domain/recover-user-coupon.use-case";
import { Order, OrderStatus } from "@/order/domain/entities/order.entitiy";
import { ReleaseStockUseCase } from "@/product/application/use-cases/tier-1-in-domain/release-stock.use-case";
import { RecoverPointsUseCase } from "@/wallet/application/use-cases/tier-1-in-domain/recover-points.use-case";
import { ChangeOrderStatusUseCase } from "../tier-1-in-domain/change-order-status.use-case";
import { Transactional } from "typeorm-transactional";

export interface RecoverOrderCommand {
  order: Order;
  couponId: string | null;
  stockReservationIds: string[];
  idempotencyKey: string;
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

  @Transactional()
  async execute(command: RecoverOrderCommand) {
    const { order, couponId, stockReservationIds, idempotencyKey } = command;

    await Promise.all(
      stockReservationIds.map((stockReservationId) =>
        this.releaseStockUseCase.execute({
          stockReservationId,
          idempotencyKey,
        })
      )
    );

    if (couponId) {
      await this.recoverUserCouponUseCase.execute({
        userCouponId: couponId,
        idempotencyKey,
      });
    }

    await this.recoverPointsUseCase.execute({
      userId: order.userId,
      amount: order.finalPrice,
      idempotencyKey,
    });

    await this.changeOrderStatusUseCase.execute({
      orderId: order.id,
      status: OrderStatus.FAILED,
    });

    return {
      order,
    };
  }
}
