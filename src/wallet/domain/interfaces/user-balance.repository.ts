import { UserBalance } from "../entities/user-balance.entity";

export interface UserBalanceRepositoryInterface {
  findByUserId(userId: string): Promise<UserBalance | null>;
  save(userBalance: UserBalance): Promise<UserBalance>;
}
