import { Injectable } from "@nestjs/common";
import { UserBalanceNotFoundError } from "@/wallet/domain/exceptions/point.exceptions";
import { UserBalanceRepository } from "@/wallet/infrastructure/persistence/use-balance.repository";
import { ValidatePointTransactionService } from "@/wallet/domain/services/validate-point-transaction.service";

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
    private readonly userBalanceRepository: UserBalanceRepository,
    private readonly validatePointTransactionService: ValidatePointTransactionService
  ) {}

  async execute(
    command: ValidateUsePointsUseCaseCommand
  ): Promise<ValidateUsePointsUseCaseResult> {
    const { userId, amount } = command;

    const userBalance = await this.userBalanceRepository.findByUserId(userId);

    if (!userBalance) {
      throw new UserBalanceNotFoundError(userId);
    }

    const isValid = this.validatePointTransactionService.validateUsePoints({
      amount,
      userBalance,
      withThrow: false,
    });

    return { isValid };
  }
}
