import { Inject, Injectable } from "@nestjs/common";
import { Order } from "@/order/domain/entities/order.entitiy";
import { OrderRepositoryInterface } from "@/order/domain/interfaces/order.repository.interface";
import { OrderNotFoundError } from "@/order/domain/exceptions/order.exceptions";

export interface ApplyDiscountUseCaseCommand {
  orderId: string;
  appliedCouponId: string;
  discountPrice: number;
  discountedPrice: number;
}

export interface ApplyDiscountUseCaseResult {
  order: Order;
}

@Injectable()
export class ApplyDiscountUseCase {
  constructor(
    @Inject("OrderRepositoryInterface")
    private readonly orderRepository: OrderRepositoryInterface
  ) {}

  async execute(
    command: ApplyDiscountUseCaseCommand
  ): Promise<ApplyDiscountUseCaseResult> {
    const { orderId, appliedCouponId, discountPrice, discountedPrice } =
      command;

    const order = await this.orderRepository.findById(orderId);
    if (!order) {
      throw new OrderNotFoundError(orderId);
    }

    order.applyDiscount({
      appliedCouponId,
      discountPrice,
      discountedPrice,
    });

    await this.orderRepository.save(order);

    return { order };
  }
}
