import { Inject, Injectable } from "@nestjs/common";
import { UserBalanceRepositoryInterface } from "../interfaces/user-balance.repository";
import { UserBalance } from "../entities/user-balance.entity";

export interface CreateUserBalanceUseCaseCommand {
  userId: string;
}

export interface CreateUserBalanceUseCaseResult {
  userBalance: UserBalance;
}

@Injectable()
export class CreateUserBalanceUseCase {
  constructor(
    @Inject("UserBalanceRepositoryInterface")
    private readonly userBalanceRepository: UserBalanceRepositoryInterface
  ) {}

  async execute(
    command: CreateUserBalanceUseCaseCommand
  ): Promise<CreateUserBalanceUseCaseResult> {
    const { userId } = command;

    const userBalance = await this.userBalanceRepository.findByUserId(userId);

    if (userBalance) {
      return { userBalance };
    }

    const newUserBalance = UserBalance.create({
      userId,
      balance: 0,
    });

    return { userBalance: newUserBalance };
  }
}
