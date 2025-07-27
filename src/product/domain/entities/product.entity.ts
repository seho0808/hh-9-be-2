import { InsufficientStockError } from "../exceptions/product.exceptions";
import { v4 as uuidv4 } from "uuid";

export interface ProductProps {
  id: string;
  name: string;
  description: string;
  price: number;
  totalStock: number;
  reservedStock: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class Product {
  private constructor(private readonly props: ProductProps) {}

  static create(
    props: Omit<ProductProps, "id" | "createdAt" | "updatedAt">
  ): Product {
    const now = new Date();
    return new Product({
      ...props,
      id: uuidv4(),
      createdAt: now,
      updatedAt: now,
    });
  }

  reserveStock(amount: number): void {
    if (this.getAvailableStock() < amount) {
      throw new InsufficientStockError(
        this.props.id,
        this.props.totalStock,
        amount
      );
    }
    this.props.reservedStock += amount;
    this.props.updatedAt = new Date();
  }

  confirmStock(amount: number): void {
    if (this.props.reservedStock < amount) {
      throw new InsufficientStockError(
        this.props.id,
        this.props.totalStock,
        amount
      );
    }
    this.props.reservedStock -= amount;
    this.props.totalStock -= amount;
    this.props.updatedAt = new Date();
  }

  releaseStock(amount: number): void {
    if (this.props.reservedStock < amount) {
      throw new InsufficientStockError(
        this.props.id,
        this.props.totalStock,
        amount
      );
    }
    this.props.reservedStock -= amount;
    this.props.updatedAt = new Date();
  }

  activate(): void {
    this.props.isActive = true;
    this.props.updatedAt = new Date();
  }

  deactivate(): void {
    this.props.isActive = false;
    this.props.updatedAt = new Date();
  }

  getAvailableStock(): number {
    return this.props.totalStock - this.props.reservedStock;
  }

  static fromPersistence(props: ProductProps): Product {
    return new Product(props);
  }

  toPersistence(): ProductProps {
    return { ...this.props };
  }

  static isValidName(name: string): boolean {
    return name && name.trim().length >= 2 && name.trim().length <= 100;
  }

  static isValidPrice(price: number): boolean {
    return price >= 0 && price <= 10_000_000;
  }

  static isValidStockReduction(
    currentStock: number,
    reductionAmount: number
  ): boolean {
    return currentStock >= reductionAmount && reductionAmount >= 0;
  }

  get id(): string {
    return this.props.id;
  }

  get name(): string {
    return this.props.name;
  }

  get description(): string {
    return this.props.description;
  }

  get price(): number {
    return this.props.price;
  }

  get totalStock(): number {
    return this.props.totalStock;
  }

  get reservedStock(): number {
    return this.props.reservedStock;
  }

  get isActive(): boolean {
    return this.props.isActive;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }
}
