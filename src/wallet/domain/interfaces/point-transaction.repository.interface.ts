import { PointTransaction } from "../entities/point-transaction.entity";

export interface PointTransactionRepositoryInterface {
  findByUserId(userId: string): Promise<PointTransaction[]>;
  findByOrderIdempotencyKey(
    userId: string,
    idempotencyKey: string
  ): Promise<PointTransaction[]>;
  save(pointTransaction: PointTransaction): Promise<PointTransaction>;
}
