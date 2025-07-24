import { Injectable, Inject } from "@nestjs/common";
import { UserBalance } from "../entities/user-balance.entity";
import { UserBalanceNotFoundError } from "../exceptions/point.exception";
import { UserBalanceRepositoryInterface } from "../interfaces/user-balance.repository";

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
      // Return a default balance of 0 instead of throwing an error
      const defaultBalance = UserBalance.create({
        userId,
        balance: 0,
      });
      return { userBalance: defaultBalance };
    }

    return { userBalance };
  }
}
