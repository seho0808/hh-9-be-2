import { Injectable } from "@nestjs/common";
import { Order, OrderStatus } from "@/order/domain/entities/order.entitiy";
import { ApplyDiscountUseCase } from "../tier-1-in-domain/apply-discount.use-case";
import { UseUserCouponUseCase } from "@/coupon/application/use-cases/tier-1-in-domain/use-user-coupon.use-case";
import { UsePointsUseCase } from "@/wallet/application/use-cases/tier-1-in-domain/use-points.use-case";
import { ConfirmStockUseCase } from "@/product/application/use-cases/tier-1-in-domain/confirm-stock.use-case";
import { ChangeOrderStatusUseCase } from "../tier-1-in-domain/change-order-status.use-case";
import { UpdateProductRankingUseCase } from "../tier-1-in-domain/update-product-ranking.use-case";
import { IsolationLevel, Transactional } from "typeorm-transactional";
import { RetryOnOptimisticLock } from "@/common/decorators/retry-on-optimistic-lock.decorator";

export interface ProcessOrderCommand {
  userId: string;
  userCouponId: string | null;
  order: Order;
  discountPrice: number;
  discountedPrice: number;
  stockReservationIds: string[];
  idempotencyKey: string;
}

export interface ProcessOrderResult {
  order: Order;
}

@Injectable()
export class ProcessOrderUseCase {
  constructor(
    private readonly applyDiscountUseCase: ApplyDiscountUseCase,
    private readonly useUserCouponUseCase: UseUserCouponUseCase,
    private readonly usePointsUseCase: UsePointsUseCase,
    private readonly confirmStockUseCase: ConfirmStockUseCase,
    private readonly changeOrderStatusUseCase: ChangeOrderStatusUseCase,
    private readonly updateProductRankingUseCase: UpdateProductRankingUseCase
  ) {}

  @RetryOnOptimisticLock(5, 50)
  @Transactional({ isolationLevel: IsolationLevel.READ_COMMITTED })
  async execute(command: ProcessOrderCommand) {
    const {
      userId,
      userCouponId,
      discountPrice,
      discountedPrice,
      stockReservationIds,
      idempotencyKey,
    } = command;
    let order = command.order;

    // 쿠폰 적용
    if (userCouponId) {
      const { order: discountedOrder } =
        await this.applyDiscountUseCase.execute({
          orderId: order.id,
          appliedUserCouponId: userCouponId,
          discountPrice,
          discountedPrice,
        });
      order = discountedOrder;

      await this.useUserCouponUseCase.execute({
        userCouponId,
        orderId: order.id,
        orderPrice: order.totalPrice,
      });
    }

    // 잔고 사용
    const finalAmountToPay = order.finalPrice;
    await this.usePointsUseCase.execute({
      userId,
      amount: finalAmountToPay,
      idempotencyKey,
      refId: order.id,
    });

    // 재고 확정
    await Promise.all(
      // TODO: 한 번의 쿼리로 변경되도록 use-case 수정 필요함.
      stockReservationIds.map((stockReservationId) =>
        this.confirmStockUseCase.execute({
          stockReservationId,
          orderId: order.id,
        })
      )
    );

    // 주문 상태 변경
    const { order: successOrder } = await this.changeOrderStatusUseCase.execute(
      {
        orderId: order.id,
        status: OrderStatus.SUCCESS,
      }
    );

    // Redis 인기 상품 랭킹 업데이트
    this.updateProductRankingUseCase.execute({ order: successOrder });

    return {
      order: successOrder,
    };
  }
}
