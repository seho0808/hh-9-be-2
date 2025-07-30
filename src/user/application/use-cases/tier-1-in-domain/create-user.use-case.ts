import { Injectable, Inject } from "@nestjs/common";
import { UserRepositoryInterface } from "@/user/domain/interfaces/user.repository.interface";
import { User } from "@/user/domain/entities/user.entity";
import { ValidateUserService } from "@/user/domain/services/validate-user.service";

export interface CreateUserCommand {
  email: string;
  hashedPassword: string;
  name: string;
}

@Injectable()
export class CreateUserUseCase {
  constructor(
    @Inject("UserRepositoryInterface")
    private readonly userRepository: UserRepositoryInterface,
    private readonly validateUserService: ValidateUserService
  ) {}

  async execute(command: CreateUserCommand): Promise<User> {
    const { email, hashedPassword, name } = command;

    await this.validateUserService.validateUser({
      email,
      name,
      isEmailDuplicate: async () => await this.isEmailDuplicate(email),
    });

    const user = User.create({
      email,
      password: hashedPassword,
      name,
    });

    await this.userRepository.save(user);

    return user;
  }

  private async isEmailDuplicate(email: string): Promise<boolean> {
    return this.userRepository.exists(email);
  }
}
