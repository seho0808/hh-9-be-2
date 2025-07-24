import { v4 as uuidv4 } from "uuid";

export interface PointTransactionProps {
  id: string;
  userId: string;
  amount: number;
  type: "CHARGE" | "USE" | "RECOVER";
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
}
