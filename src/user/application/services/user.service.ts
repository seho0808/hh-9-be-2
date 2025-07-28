import { Injectable } from "@nestjs/common";
import { GetUserByIdUseCase } from "@/user/application/use-cases/tier-1-in-domain/get-user-by-id.use-case";
import { GetUserByEmailUseCase } from "@/user/application/use-cases/tier-1-in-domain/get-user-by-email.use-case";
import {
  CreateUserUseCase,
  CreateUserCommand,
} from "@/user/application/use-cases/tier-1-in-domain/create-user.use-case";
import { User } from "@/user/domain/entities/user.entity";
import { WalletApplicationService } from "@/wallet/application/wallet.service";
import { TransactionService } from "@/common/services/transaction.service";

@Injectable()
export class UserApplicationService {
  constructor(
    private readonly transactionService: TransactionService,
    private readonly walletApplicationService: WalletApplicationService,
    private readonly getUserByIdUseCase: GetUserByIdUseCase,
    private readonly getUserByEmailUseCase: GetUserByEmailUseCase,
    private readonly createUserUseCase: CreateUserUseCase
  ) {}

  async getUserById(id: string): Promise<User | null> {
    return await this.getUserByIdUseCase.execute(id);
  }

  async getUserByEmail(email: string): Promise<User | null> {
    return await this.getUserByEmailUseCase.execute(email);
  }

  async checkEmailExists(email: string): Promise<boolean> {
    const user = await this.getUserByEmailUseCase.execute(email);
    return user !== null;
  }

  async createUser(command: CreateUserCommand): Promise<User> {
    return await this.transactionService.runWithTransaction(async (manager) => {
      // 사용자 생성
      const user = await this.createUserUseCase.execute(command);

      // 지갑 초기화
      await this.walletApplicationService.createUserBalance(user.id);

      return user;
    });
  }
}
