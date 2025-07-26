import { v4 as uuidv4 } from "uuid";

export interface PointTransactionProps {
  id: string;
  userId: string;
  amount: number;
  type: "CHARGE" | "USE" | "RECOVER";
  idempotencyKey: string;
  createdAt: Date;
}

export class PointTransaction {
  private constructor(private readonly props: PointTransactionProps) {}

  static create(
    props: Omit<PointTransactionProps, "id" | "createdAt">
  ): PointTransaction {
    return new PointTransaction({
      ...props,
      id: uuidv4(),
      createdAt: new Date(),
    });
  }

  static fromPersistence(props: PointTransactionProps): PointTransaction {
    return new PointTransaction(props);
  }

  toPersistence(): PointTransactionProps {
    return {
      ...this.props,
    };
  }

  get id(): string {
    return this.props.id;
  }

  get userId(): string {
    return this.props.userId;
  }

  get amount(): number {
    return this.props.amount;
  }

  get type(): "CHARGE" | "USE" | "RECOVER" {
    return this.props.type;
  }

  get idempotencyKey(): string {
    return this.props.idempotencyKey;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }
}
