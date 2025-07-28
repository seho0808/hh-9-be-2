import { Injectable } from "@nestjs/common";
import { GetUserByIdUseCase } from "@/user/application/use-cases/tier-1-in-domain/get-user-by-id.use-case";
import { GetUserByEmailUseCase } from "@/user/application/use-cases/tier-1-in-domain/get-user-by-email.use-case";
import { CreateUserCommand } from "@/user/application/use-cases/tier-1-in-domain/create-user.use-case";
import { User } from "@/user/domain/entities/user.entity";
import { TransactionService } from "@/common/services/transaction.service";
import { CreateUserUseCaseWithBalanceUseCase } from "../use-cases/tier-2/create-user-with-balance.use-case";

@Injectable()
export class UserApplicationService {
  constructor(
    private readonly transactionService: TransactionService,
    private readonly getUserByIdUseCase: GetUserByIdUseCase,
    private readonly getUserByEmailUseCase: GetUserByEmailUseCase,
    private readonly createUserUseCaseWithBalance: CreateUserUseCaseWithBalanceUseCase
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
      const user = await this.createUserUseCaseWithBalance.execute(command);
      return user;
    });
  }
}
