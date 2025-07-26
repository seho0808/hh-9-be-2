import { v4 as uuidv4 } from "uuid";
import {
  InvalidChargeAmountError,
  InvalidUseAmountError,
} from "../exceptions/point.exceptions";

export interface UserBalanceProps {
  id: string;
  userId: string;
  balance: number;
  createdAt: Date;
  updatedAt: Date;
}

export class UserBalance {
  public static readonly MIN_CHARGE_AMOUNT = 1000;
  public static readonly MAX_CHARGE_AMOUNT = 100_000;
  public static readonly MIN_BALANCE = 0;
  public static readonly MAX_BALANCE = 1_000_000_000;
  public static readonly CHARGE_UNIT = 10;

  private constructor(private readonly props: UserBalanceProps) {}

  static create(
    props: Omit<UserBalanceProps, "id" | "createdAt" | "updatedAt">
  ): UserBalance {
    const now = new Date();
    return new UserBalance({
      ...props,
      id: uuidv4(),
      createdAt: now,
      updatedAt: now,
    });
  }

  addBalance(amount: number): void {
    if (
      amount < UserBalance.MIN_CHARGE_AMOUNT ||
      amount > UserBalance.MAX_CHARGE_AMOUNT ||
      this.props.balance + amount > UserBalance.MAX_BALANCE ||
      this.props.balance + amount < UserBalance.MIN_BALANCE ||
      amount % UserBalance.CHARGE_UNIT !== 0
    ) {
      throw new InvalidChargeAmountError(amount);
    }

    this.props.balance += amount;
    this.props.updatedAt = new Date();
  }

  subtractBalance(amount: number): void {
    if (
      this.props.balance - amount < UserBalance.MIN_BALANCE ||
      this.props.balance - amount > UserBalance.MAX_BALANCE
    ) {
      throw new InvalidUseAmountError(amount);
    }

    this.props.balance -= amount;
    this.props.updatedAt = new Date();
  }

  static fromPersistence(props: UserBalanceProps): UserBalance {
    return new UserBalance(props);
  }

  toPersistence(): UserBalanceProps {
    return {
      ...this.props,
    };
  }

  get balance(): number {
    return this.props.balance;
  }

  get id(): string {
    return this.props.id;
  }

  get userId(): string {
    return this.props.userId;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }
}
