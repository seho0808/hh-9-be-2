import { Injectable } from "@nestjs/common";
import { GetUserByIdUseCase } from "@/user/domain/use-cases/get-user-by-id.use-case";
import { GetUserByEmailUseCase } from "@/user/domain/use-cases/get-user-by-email.use-case";
import {
  CreateUserUseCase,
  CreateUserCommand,
} from "@/user/domain/use-cases/create-user.use-case";
import {
  UpdateUserNameUseCase,
  UpdateUserNameCommand,
} from "@/user/domain/use-cases/update-user-name.use-case";
import { User } from "@/user/domain/entities/user.entity";

@Injectable()
export class UserApplicationService {
  constructor(
    private readonly getUserByIdUseCase: GetUserByIdUseCase,
    private readonly getUserByEmailUseCase: GetUserByEmailUseCase,
    private readonly createUserUseCase: CreateUserUseCase,
    private readonly updateUserNameUseCase: UpdateUserNameUseCase
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

    return this.createUserUseCase.execute(command);
  }

  async updateUserName(userId: string, newName: string): Promise<User> {
    const command: UpdateUserNameCommand = {
      userId,
      newName,
    };

    return await this.updateUserNameUseCase.execute(command);
  }
}
