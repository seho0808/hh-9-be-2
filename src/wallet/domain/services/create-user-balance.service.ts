import { UserBalance } from "../entities/user-balance.entity";

export class CreateUserBalanceDomainService {
  async createUserBalance({
    userId,
    userBalance,
  }: {
    userId: string;
    userBalance: UserBalance | null;
  }): Promise<UserBalance> {
    if (userBalance) {
      return userBalance;
    }

    const newUserBalance = UserBalance.create({
      userId,
      balance: 0,
    });

    return newUserBalance;
  }
}
