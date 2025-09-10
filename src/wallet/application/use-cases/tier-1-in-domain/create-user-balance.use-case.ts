import { Injectable } from "@nestjs/common";
import { UserBalance } from "@/wallet/domain/entities/user-balance.entity";
import { UserBalanceRepository } from "@/wallet/infrastructure/persistence/use-balance.repository";

export interface CreateUserBalanceUseCaseCommand {
  userId: string;
}

export interface CreateUserBalanceUseCaseResult {
  userBalance: UserBalance;
}

@Injectable()
export class CreateUserBalanceUseCase {
  constructor(private readonly userBalanceRepository: UserBalanceRepository) {}

  async execute(
    command: CreateUserBalanceUseCaseCommand
  ): Promise<CreateUserBalanceUseCaseResult> {
    const { userId } = command;

    const data = await this.userBalanceRepository.findByUserId(userId);

    if (data) {
      return { userBalance: data.userBalance };
    }

    const newUserBalance = UserBalance.create({
      userId,
      balance: 0,
    });

    await this.userBalanceRepository.save(newUserBalance);

    return { userBalance: newUserBalance };
  }
}
