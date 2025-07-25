import { Injectable, Inject } from "@nestjs/common";
import { UserBalance } from "../entities/user-balance.entity";
import { UserBalanceRepositoryInterface } from "../interfaces/user-balance.repository.interface";

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
      const defaultBalance = UserBalance.create({
        userId,
        balance: 0,
      });
      return { userBalance: defaultBalance };
    }

    return { userBalance };
  }
}
