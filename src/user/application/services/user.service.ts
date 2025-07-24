import { Injectable } from "@nestjs/common";
import { GetUserByIdUseCase } from "@/user/domain/use-cases/get-user-by-id.use-case";
import { GetUserByEmailUseCase } from "@/user/domain/use-cases/get-user-by-email.use-case";
import {
  CreateUserUseCase,
  CreateUserCommand,
} from "@/user/domain/use-cases/create-user.use-case";
import { User } from "@/user/domain/entities/user.entity";
import { WalletApplicationService } from "@/wallet/application/wallet.service";

@Injectable()
export class UserApplicationService {
  constructor(
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
    const command: CreateUserCommand = {
      email,
      hashedPassword,
      name,
    };

    // TODO: transaction으로 묶어서 동시에 유저 생성과 지갑 생성 처리
    const user = await this.createUserUseCase.execute(command);
    await this.walletApplicationService.createUserBalance(user.id);

    return user;
  }
}
