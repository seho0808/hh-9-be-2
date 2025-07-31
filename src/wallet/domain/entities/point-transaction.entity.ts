import { v4 as uuidv4 } from "uuid";

export interface PointTransactionProps {
  id: string;
  userId: string;
  amount: number;
  type: "CHARGE" | "USE" | "RECOVER";
  idempotencyKey: string | null;
  refId: string | null;
  createdAt: Date;
}

export class PointTransaction {
  constructor(private readonly props: PointTransactionProps) {}

  static create(
    props: Omit<PointTransactionProps, "id" | "createdAt">
  ): PointTransaction {
    return new PointTransaction({
      ...props,
      id: uuidv4(),
      createdAt: new Date(),
    });
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

  get refId(): string {
    return this.props.refId;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }
}
