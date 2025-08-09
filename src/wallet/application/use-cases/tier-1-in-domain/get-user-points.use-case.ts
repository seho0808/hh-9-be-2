import { Injectable, Inject } from "@nestjs/common";
import { UserBalance } from "@/wallet/domain/entities/user-balance.entity";
import { UserBalanceRepository } from "@/wallet/infrastructure/persistence/use-balance.repository";

export interface GetUserPointsUseCaseCommand {
  userId: string;
}

export interface GetUserPointsUseCaseResult {
  userBalance: UserBalance;
}

@Injectable()
export class GetUserPointsUseCase {
  constructor(private readonly userBalanceRepository: UserBalanceRepository) {}

  async execute(
    command: GetUserPointsUseCaseCommand
  ): Promise<GetUserPointsUseCaseResult> {
    const { userId } = command;

    const data = await this.userBalanceRepository.findByUserId(userId);

    if (!data) {
      const newUserBalance = UserBalance.create({
        userId,
        balance: 0,
      });
      return { userBalance: newUserBalance };
    }

    return { userBalance: data.userBalance };
  }
}
