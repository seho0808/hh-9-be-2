import { Injectable, Inject } from "@nestjs/common";
import { UserBalanceNotFoundError } from "../exceptions/point.exceptions";
import { UserBalanceRepositoryInterface } from "../interfaces/user-balance.repository";

export interface ValidateUsePointsUseCaseCommand {
  userId: string;
  amount: number;
}

export interface ValidateUsePointsUseCaseResult {
  isValid: boolean;
}

@Injectable()
export class ValidateUsePointsUseCase {
  constructor(
    @Inject("UserBalanceRepositoryInterface")
    private readonly userBalanceRepository: UserBalanceRepositoryInterface
  ) {}

  async execute(
    command: ValidateUsePointsUseCaseCommand
  ): Promise<ValidateUsePointsUseCaseResult> {
    const { userId, amount } = command;

    const userBalance = await this.userBalanceRepository.findByUserId(userId);

    if (!userBalance) {
      throw new UserBalanceNotFoundError(userId);
    }

    if (userBalance.balance < amount) {
      return { isValid: false };
    }

    return { isValid: true };
  }
}
