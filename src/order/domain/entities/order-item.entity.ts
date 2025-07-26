import { v4 as uuidv4 } from "uuid";

export interface OrderItemProps {
  id: string;
  orderId: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  createdAt: Date;
  updatedAt: Date;
}

export class OrderItem {
  constructor(private readonly props: OrderItemProps) {}

  static create(
    props: Omit<OrderItemProps, "id" | "createdAt" | "updatedAt" | "totalPrice">
  ): OrderItem {
    const now = new Date();
    return new OrderItem({
      ...props,
      id: uuidv4(),
      totalPrice: OrderItem.calculateTotalPrice(
        props.unitPrice,
        props.quantity
      ),
      createdAt: now,
      updatedAt: now,
    });
  }

  static calculateTotalPrice(unitPrice: number, quantity: number): number {
    return unitPrice * quantity;
  }

  static fromPersistence(props: OrderItemProps): OrderItem {
    return new OrderItem(props);
  }

  toPersistence(): OrderItemProps {
    return this.props;
  }

  get id(): string {
    return this.props.id;
  }

  get orderId(): string {
    return this.props.orderId;
  }

  get productId(): string {
    return this.props.productId;
  }

  get quantity(): number {
    return this.props.quantity;
  }

  get unitPrice(): number {
    return this.props.unitPrice;
  }

  get totalPrice(): number {
    return this.props.totalPrice;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }
}
