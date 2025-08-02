import { Injectable } from "@nestjs/common";
import { Order } from "@/order/domain/entities/order.entitiy";
import { ProcessOrderUseCase } from "../tier-2/process-order.use-case";
import { PrepareOrderUseCase } from "../tier-3/prepare-order.use-case";
import { RecoverOrderUseCase } from "../tier-2/recover-order.use-case";
import { GetProductsPriceUseCase } from "@/product/application/use-cases/tier-1-in-domain/get-products-price.use-case";

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
export class PlaceOrderUseCase {
  constructor(
    private readonly prepareOrderUseCase: PrepareOrderUseCase,
    private readonly processOrderUseCase: ProcessOrderUseCase,
    private readonly recoverOrderUseCase: RecoverOrderUseCase,
    private readonly getProductsPriceUseCase: GetProductsPriceUseCase
  ) {}

  async execute(command: PlaceOrderCommand): Promise<PlaceOrderResult> {
    const { userId, couponId, idempotencyKey, itemsWithoutPrices } = command;

    const items = await this.getItemsWithPrices(itemsWithoutPrices);

    const { order, discountPrice, discountedPrice, stockReservationIds } =
      await this.prepareOrderUseCase.execute({
        userId,
        couponId,
        items,
        idempotencyKey,
      });

    try {
      const { order: successOrder } = await this.processOrderUseCase.execute({
        userId,
        couponId,
        order,
        discountPrice,
        discountedPrice,
        stockReservationIds,
        idempotencyKey,
      });

      return {
        order: successOrder,
      };
    } catch (error) {
      await this.recoverOrderUseCase.execute({
        order,
        couponId,
        stockReservationIds,
        orderId: order.id,
      });
      throw error;
    }
  }

  async getItemsWithPrices(
    itemsWithoutPrices: { productId: string; quantity: number }[]
  ) {
    const { productPriceInfo } = await this.getProductsPriceUseCase.execute({
      productIds: itemsWithoutPrices.map((item) => item.productId),
    });

    return itemsWithoutPrices.map((item) => ({
      ...item,
      unitPrice: productPriceInfo.find((p) => p.productId === item.productId)
        ?.unitPrice,
    }));
  }
}
