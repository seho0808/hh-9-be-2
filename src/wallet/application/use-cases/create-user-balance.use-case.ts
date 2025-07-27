import { Inject, Injectable } from "@nestjs/common";
import { UserBalanceRepositoryInterface } from "@/wallet/domain/interfaces/user-balance.repository.interface";
import { UserBalance } from "@/wallet/domain/entities/user-balance.entity";
import { CreateUserBalanceDomainService } from "@/wallet/domain/services/create-user-balance.service";

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
    private readonly userBalanceRepository: UserBalanceRepositoryInterface,
    private readonly createUserBalanceDomainService: CreateUserBalanceDomainService
  ) {}

  async execute(
    command: CreateUserBalanceUseCaseCommand
  ): Promise<CreateUserBalanceUseCaseResult> {
    const { userId } = command;

    const userBalance = await this.userBalanceRepository.findByUserId(userId);

    const newUserBalance =
      await this.createUserBalanceDomainService.createUserBalance({
        userId,
        userBalance,
      });

    return { userBalance: newUserBalance };
  }
}
