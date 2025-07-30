import { Injectable, Inject } from "@nestjs/common";
import { UserBalance } from "@/wallet/domain/entities/user-balance.entity";
import { UserBalanceRepositoryInterface } from "@/wallet/domain/interfaces/user-balance.repository.interface";

export interface GetUserPointsUseCaseCommand {
  userId: string;
}

export interface GetUserPointsUseCaseResult {
  userBalance: UserBalance;
}

@Injectable()
export class GetUserPointsUseCase {
  constructor(
    @Inject("UserBalanceRepositoryInterface")
    private readonly userBalanceRepository: UserBalanceRepositoryInterface
  ) {}

  async execute(
    command: GetUserPointsUseCaseCommand
  ): Promise<GetUserPointsUseCaseResult> {
    const { userId } = command;

    const userBalance = await this.userBalanceRepository.findByUserId(userId);

    if (!userBalance) {
      const newUserBalance = UserBalance.create({
        userId,
        balance: 0,
      });
      return { userBalance: newUserBalance };
    }

    return { userBalance };
  }
}
