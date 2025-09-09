export interface DataPlatformOrderItemPayload {
  productId: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface DataPlatformOrderPayload {
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

export interface DataPlatformOrderEvent {
  eventId: string;
  eventType: string;
  timestamp: string;
  data: DataPlatformOrderPayload;
  idempotencyKey: string;
}
