import { UserBalance } from "../entities/user-balance.entity";

export class GetUserBalanceDomainService {
  async getUserBalance({
    userId,
    userBalance,
  }: {
    userId: string;
    userBalance: UserBalance | null;
  }): Promise<UserBalance> {
    if (!userBalance) {
      const newUserBalance = UserBalance.create({
        userId,
        balance: 0,
      });
      return newUserBalance;
    }

    return userBalance;
  }
}
