import { Injectable, Logger, LoggerService } from "@nestjs/common";
import { Order } from "@/order/domain/entities/order.entitiy";
import { OnEvent } from "@nestjs/event-emitter";
import { OrderPlacedEvent } from "@/order/infrastructure/messaging/events";
import {
  DataPlatformHttpException,
  DataPlatformNetworkException,
  DataPlatformTimeoutException,
} from "@/order/infrastructure/exceptions/data-platform.exceptions";
import { v4 as uuidv4 } from "uuid";

interface DataPlatformOrderItemPayload {
  productId: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

interface DataPlatformOrderPayload {
  eventId: string;
  orderId: string;
  userId: string;
  totalPrice: number;
  discountPrice: number;
  finalPrice: number;
  createdAt: string;
  items: DataPlatformOrderItemPayload[];
  idempotencyKey: string;
}

@Injectable()
export class DataPlatformMessaging {
  private readonly logger: LoggerService;
  private readonly endpoint: string;
  private readonly timeoutMs: number;
  private readonly sleepFn: (ms: number) => Promise<void>;

  constructor(options?: {
    endpoint?: string;
    timeoutMs?: number;
    logger?: LoggerService;
    sleep?: (ms: number) => Promise<void>;
  }) {
    this.logger = options?.logger ?? new Logger(DataPlatformMessaging.name);
    this.endpoint = options?.endpoint || "http://localhost:4000/mock/orders";
    this.timeoutMs =
      options?.timeoutMs ??
      Number(process.env.MOCK_DATA_PLATFORM_TIMEOUT_MS || 3000);
    this.sleepFn = options?.sleep ?? ((ms) => this.sleep(ms));
  }

  @OnEvent("order.placed", { async: true })
  async publishOrderPlaced(event: OrderPlacedEvent): Promise<void> {
    const order: Order = event.order;
    const payload: DataPlatformOrderPayload = this.buildPayload(order);
    await this.postWithRetry(payload, order.id);
  }

  private buildPayload(order: Order): DataPlatformOrderPayload {
    return {
      eventId: uuidv4(),
      orderId: order.id,
      userId: order.userId,
      totalPrice: order.totalPrice,
      discountPrice: order.discountPrice,
      finalPrice: order.finalPrice,
      createdAt: order.createdAt.toISOString(),
      items: order.orderItems.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: item.totalPrice,
      })),
      idempotencyKey: order.id,
    };
  }

  private async postWithRetry(
    payload: DataPlatformOrderPayload,
    orderId: string
  ): Promise<void> {
    const maxAttempts = 3;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const { controller, timeout } = this.createTimeoutController();
      try {
        await this.sendOnce(payload, controller);
        this.logSuccess(orderId, attempt);
        return;
      } catch (error) {
        const backoffMs = this.getBackoffMs(attempt);
        this.logFailure(orderId, attempt, maxAttempts, error, backoffMs);
        if (attempt < maxAttempts) {
          await this.sleepFn(backoffMs);
        }
      } finally {
        clearTimeout(timeout);
      }
    }
  }

  private createTimeoutController(): {
    controller: AbortController;
    timeout: ReturnType<typeof setTimeout>;
  } {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    return { controller, timeout };
  }

  private async sendOnce(
    payload: DataPlatformOrderPayload,
    controller: AbortController
  ): Promise<void> {
    let response: any;
    try {
      response = await fetch(this.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        throw new DataPlatformTimeoutException(this.timeoutMs);
      }
      throw new DataPlatformNetworkException(err);
    }

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new DataPlatformHttpException(response.status, body);
    }
  }

  private getBackoffMs(attempt: number): number {
    return Math.min(1000 * 2 ** (attempt - 1), 4000);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private logSuccess(orderId: string, attempt: number): void {
    this.logger.log(
      `Published order ${orderId} to data platform (attempt ${attempt}).`
    );
  }

  private logFailure(
    orderId: string,
    attempt: number,
    maxAttempts: number,
    error: unknown,
    backoffMs: number
  ): void {
    this.logger.warn(
      `Failed to publish order ${orderId} (attempt ${attempt}/${maxAttempts}): ${String(
        (error as Error)?.message || error
      )}.` + (attempt < maxAttempts ? ` Retrying in ${backoffMs}ms...` : "")
    );
  }
}
