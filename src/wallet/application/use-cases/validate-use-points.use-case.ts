import { Injectable, Inject } from "@nestjs/common";
import { UserBalanceNotFoundError } from "@/wallet/domain/exceptions/point.exceptions";
import { UserBalanceRepositoryInterface } from "@/wallet/domain/interfaces/user-balance.repository.interface";
import { ValidateUsePointsDomainService } from "@/wallet/domain/services/validate-use-points.service";

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
    private readonly userBalanceRepository: UserBalanceRepositoryInterface,
    private readonly validateUsePointsDomainService: ValidateUsePointsDomainService
  ) {}

  async execute(
    command: ValidateUsePointsUseCaseCommand
  ): Promise<ValidateUsePointsUseCaseResult> {
    const { userId, amount } = command;

    const userBalance = await this.userBalanceRepository.findByUserId(userId);

    if (!userBalance) {
      throw new UserBalanceNotFoundError(userId);
    }

    const isValid = await this.validateUsePointsDomainService.validateUsePoints(
      {
        userId,
        amount,
        userBalance,
      }
    );

    return { isValid };
  }
}
