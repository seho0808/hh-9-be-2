import { Injectable, Inject } from "@nestjs/common";
import { UserBalance } from "@/wallet/domain/entities/user-balance.entity";
import { UserBalanceRepositoryInterface } from "@/wallet/domain/interfaces/user-balance.repository.interface";
import { GetUserBalanceDomainService } from "@/wallet/domain/services/get-user-balance.service";

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
    private readonly userBalanceRepository: UserBalanceRepositoryInterface,
    private readonly getUserBalanceDomainService: GetUserBalanceDomainService
  ) {}

  async execute(
    command: GetUserPointsUseCaseCommand
  ): Promise<GetUserPointsUseCaseResult> {
    const { userId } = command;

    const userBalance = await this.userBalanceRepository.findByUserId(userId);
    const ensuredUserBalance =
      await this.getUserBalanceDomainService.getUserBalance({
        userId,
        userBalance,
      });

    return { userBalance: ensuredUserBalance };
  }
}
