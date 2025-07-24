import { Injectable } from "@nestjs/common";
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
    private readonly couponApplicationService: CouponApplicationService,
    private readonly productApplicationService: ProductApplicationService,
    private readonly walletApplicationService: WalletApplicationService,
    private readonly createOrderUseCase: CreateOrderUseCase,
    private readonly changeOrderStatusUseCase: ChangeOrderStatusUseCase,
    private readonly applyDiscountUseCase: ApplyDiscountUseCase,
    private readonly getOrderByIdUseCase: GetOrderByIdUseCase,
    private readonly getOrderByUserIdUseCase: GetOrderByUserIdUseCase
  ) {}

  // TODO: transaction 적용
  async placeOrder(command: PlaceOrderCommand): Promise<PlaceOrderResult> {
    const { userId, couponId, idempotencyKey, itemsWithoutPrices } = command;

    const items = await this.getItemsWithPrices(itemsWithoutPrices);

    // 주문 생성 및 사전 검증
    const { order, discountPrice, discountedPrice, stockReservationIds } =
      await this.prepareOrder({ userId, couponId, items, idempotencyKey });

    try {
      // 할인/결제/재고 확정 적용
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

    const { order } = await this.createOrderUseCase.execute({
      userId,
      idempotencyKey,
      items,
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
    for (const item of items) {
      const { stockReservation } =
        await this.productApplicationService.reserveStock({
          productId: item.productId,
          userId,
          quantity: item.quantity,
          idempotencyKey,
        });
      stockReservationIds.push(stockReservation.id);
    }

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
        idempotencyKey
      );
    }

    // 잔고 사용
    const finalAmountToPay = order.finalPrice;
    await this.walletApplicationService.usePoints(userId, finalAmountToPay);

    // 재고 확정
    await Promise.all(
      stockReservationIds.map((stockReservationId) =>
        this.productApplicationService.confirmStock({
          stockReservationId,
          idempotencyKey,
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
    // 재고 예약 취소
    await Promise.all(
      stockReservationIds.map((stockReservationId) =>
        this.productApplicationService.releaseStock({
          stockReservationId,
          idempotencyKey,
        })
      )
    );

    // 쿠폰 해제
    if (couponId) {
      await this.couponApplicationService.recoverUserCoupon(
        couponId,
        idempotencyKey
      );
    }

    // 잔고 복구
    // TODO: order recover 할 때 idempotencyKey 기준으로 처리해야함. wallet 쪽 모두 필드 추가해주어야함. + Payment 테이블 추가 해야할듯?
    // await this.walletApplicationService.recoverPoints(
    //   order.userId,
    //   order.discountPrice
    // );

    // 주문 상태 변경
    await this.changeOrderStatusUseCase.execute({
      orderId: order.id,
      status: OrderStatus.FAILED,
    });
  }

  async getOrderById(orderId: string): Promise<Order | null> {
    return this.getOrderByIdUseCase.execute(orderId);
  }

  async getOrdersByUserId(userId: string): Promise<Order[]> {
    return this.getOrderByUserIdUseCase.execute(userId);
  }
}
