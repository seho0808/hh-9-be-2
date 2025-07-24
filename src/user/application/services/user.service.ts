import { Injectable, Inject } from "@nestjs/common";
import { DataSource } from "typeorm";
import { GetUserByIdUseCase } from "@/user/domain/use-cases/get-user-by-id.use-case";
import { GetUserByEmailUseCase } from "@/user/domain/use-cases/get-user-by-email.use-case";
import {
  CreateUserUseCase,
  CreateUserCommand,
} from "@/user/domain/use-cases/create-user.use-case";
import { User } from "@/user/domain/entities/user.entity";
import { WalletApplicationService } from "@/wallet/application/wallet.service";
import { UserRepository } from "@/user/infrastructure/persistence/user.repository";

@Injectable()
export class UserApplicationService {
  constructor(
    private readonly dataSource: DataSource,
    @Inject("UserRepositoryInterface")
    private readonly userRepository: UserRepository,
    private readonly walletApplicationService: WalletApplicationService,
    private readonly getUserByIdUseCase: GetUserByIdUseCase,
    private readonly getUserByEmailUseCase: GetUserByEmailUseCase,
    private readonly createUserUseCase: CreateUserUseCase
  ) {}

  async getUserById(userId: string): Promise<User> {
    return await this.getUserByIdUseCase.execute(userId);
  }

  async getUserByEmail(email: string): Promise<User | null> {
    return this.getUserByEmailUseCase.execute(email);
  }

  async checkEmailExists(email: string): Promise<boolean> {
    const user = await this.getUserByEmailUseCase.execute(email);
    return user !== null;
  }

  async createUser(
    email: string,
    hashedPassword: string,
    name: string
  ): Promise<User> {
    return await this.executeInTransaction(async () => {
      const command: CreateUserCommand = {
        email,
        hashedPassword,
        name,
      };

      const user = await this.createUserUseCase.execute(command);
      await this.walletApplicationService.createUserBalance(user.id);

      return user;
    });
  }

  private async executeInTransaction<T>(
    operation: () => Promise<T>
  ): Promise<T> {
    return await this.dataSource.transaction(async (manager) => {
      this.userRepository.setEntityManager(manager);

      try {
        return await operation();
      } finally {
        this.userRepository.clearEntityManager();
      }
    });
  }
}
