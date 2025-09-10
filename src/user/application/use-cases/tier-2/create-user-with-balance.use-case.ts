import { Injectable } from "@nestjs/common";
import { CreateUserUseCase } from "../tier-1-in-domain/create-user.use-case";
import { User } from "@/user/domain/entities/user.entity";
import { CreateUserBalanceUseCase } from "@/wallet/application/use-cases/tier-1-in-domain/create-user-balance.use-case";
import { Transactional } from "typeorm-transactional";

export interface CreateUserWithBalanceCommand {
  email: string;
  hashedPassword: string;
  name: string;
}

@Injectable()
export class CreateUserUseCaseWithBalanceUseCase {
  constructor(
    private readonly createUserUseCase: CreateUserUseCase,
    private readonly createUserBalanceUseCase: CreateUserBalanceUseCase
  ) {}

  @Transactional()
  async execute(command: CreateUserWithBalanceCommand): Promise<User> {
    const user = await this.createUserUseCase.execute(command);
    await this.createUserBalanceUseCase.execute({ userId: user.id });
    return user;
  }
}
