import { Injectable } from "@nestjs/common";
import { Order } from "@/order/domain/entities/order.entitiy";
import { OrderNotFoundError } from "@/order/application/order.application.exceptions";
import { OrderRepository } from "@/order/infrastructure/persistence/order.repository";

export interface ApplyDiscountUseCaseCommand {
  orderId: string;
  appliedUserCouponId: string;
  discountPrice: number;
  discountedPrice: number;
}

export interface ApplyDiscountUseCaseResult {
  order: Order;
}

@Injectable()
export class ApplyDiscountUseCase {
  constructor(private readonly orderRepository: OrderRepository) {}

  async execute(
    command: ApplyDiscountUseCaseCommand
  ): Promise<ApplyDiscountUseCaseResult> {
    const { orderId, appliedUserCouponId, discountPrice, discountedPrice } =
      command;

    const order = await this.orderRepository.findById(orderId);
    if (!order) {
      throw new OrderNotFoundError(orderId);
    }

    order.applyDiscount({
      appliedUserCouponId,
      discountPrice,
      discountedPrice,
    });

    await this.orderRepository.save(order);

    return { order };
  }
}
