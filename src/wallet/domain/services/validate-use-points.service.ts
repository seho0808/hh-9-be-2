import { UserBalance } from "../entities/user-balance.entity";

export class ValidateUsePointsDomainService {
  async validateUsePoints({
    userId,
    amount,
    userBalance,
  }: {
    userId: string;
    amount: number;
    userBalance: UserBalance;
  }): Promise<boolean> {
    if (userBalance.balance < amount) {
      return false;
    }

    return true;
  }
}
