import { Injectable } from "@nestjs/common";
import { Order } from "../domain/entities/order.entitiy";
import { GetOrderByIdUseCase } from "@/order/application/use-cases/tier-1-in-domain/get-order-by-id.use-case";
import { GetOrderByUserIdUseCase } from "@/order/application/use-cases/tier-1-in-domain/get-order-by-user-id.use-case";
import { TransactionService } from "@/common/services/transaction.service";
import { PlaceOrderUseCase } from "./use-cases/tier-3/place-order.user-case";

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
    private readonly transactionService: TransactionService,
    private readonly getOrderByIdUseCase: GetOrderByIdUseCase,
    private readonly getOrderByUserIdUseCase: GetOrderByUserIdUseCase,
    private readonly placeOrderUseCase: PlaceOrderUseCase
  ) {}

  async placeOrder(command: PlaceOrderCommand): Promise<PlaceOrderResult> {
    return await this.placeOrderUseCase.execute(command);
  }

  async getOrderById(orderId: string): Promise<Order | null> {
    return await this.transactionService.runWithTransaction(async (manager) => {
      return await this.getOrderByIdUseCase.execute(orderId);
    });
  }

  async getOrdersByUserId(userId: string): Promise<Order[]> {
    return await this.transactionService.runWithTransaction(async (manager) => {
      return await this.getOrderByUserIdUseCase.execute(userId);
    });
  }
}
