import { Injectable } from "@nestjs/common";
import { Order } from "@/order/domain/entities/order.entitiy";
import { CreateOrderUseCase } from "../tier-1-in-domain/create-order.use-case";
import {
  InsufficientPointBalanceError,
  InvalidCouponError,
} from "@/order/application/order.application.exceptions";
import { ValidateCouponUseCase } from "@/coupon/application/use-cases/tier-1-in-domain/validate-user-coupon.use-case";
import { ValidateUsePointsUseCase } from "@/wallet/application/use-cases/tier-1-in-domain/validate-use-points.use-case";
import { ReserveStocksUseCase } from "@/product/application/use-cases/tier-2/reserve-stocks.use-case";

export interface PrepareOrderCommand {
  userId: string;
  userCouponId: string | null;
  items: { productId: string; unitPrice: number; quantity: number }[];
  idempotencyKey: string;
}

export interface PrepareOrderResult {
  order: Order;
}

@Injectable()
export class PrepareOrderUseCase {
  constructor(
    private readonly createOrderUseCase: CreateOrderUseCase,
    private readonly validateCouponUseCase: ValidateCouponUseCase,
    private readonly validateUsePointsUseCase: ValidateUsePointsUseCase,
    private readonly reserveStocksUseCase: ReserveStocksUseCase
  ) {}

  async execute(command: PrepareOrderCommand) {
    const { userId, userCouponId, items, idempotencyKey } = command;
    let discountPrice: number = 0;
    let discountedPrice: number = 0;
    let stockReservationIds: string[] = [];

    // 주문 생성
    const { order } = await this.createOrderUseCase.execute({
      userId,
      idempotencyKey,
      items,
    });

    // 쿠폰 확인
    if (userCouponId) {
      const validateResult = await this.validateCouponUseCase.execute({
        userCouponId,
        orderPrice: order.totalPrice,
      });
      discountPrice = validateResult.discountPrice;
      discountedPrice = validateResult.discountedPrice;

      if (!validateResult.isValid) {
        throw new InvalidCouponError(userCouponId);
      }
    }

    // 잔고 확인
    const walletValidationResult = await this.validateUsePointsUseCase.execute({
      userId,
      amount: order.finalPrice,
    });
    if (!walletValidationResult.isValid) {
      throw new InsufficientPointBalanceError(userId, order.finalPrice);
    }

    // 재고 예약
    const { result } = await this.reserveStocksUseCase.execute({
      requests: items.map((item) => ({
        productId: item.productId,
        userId,
        quantity: item.quantity,
        orderId: order.id,
      })),
    });

    stockReservationIds = result.map((r) => r.stockReservation.id);

    return { order, discountPrice, discountedPrice, stockReservationIds };
  }
}
