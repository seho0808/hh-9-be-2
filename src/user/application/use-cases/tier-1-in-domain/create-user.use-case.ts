import { Injectable, Inject } from "@nestjs/common";
import { UserRepositoryInterface } from "@/user/domain/interfaces/user.repository.interface";
import { User } from "@/user/domain/entities/user.entity";
import { InvalidEmailFormatError } from "@/user/domain/exceptions/user.exceptions";
import { CreateUserDomainService } from "@/user/domain/services/create-user.service";

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
    private readonly createUserDomainService: CreateUserDomainService
  ) {}

  async execute(command: CreateUserCommand): Promise<User> {
    const { email, hashedPassword, name } = command;

    if (!User.isValidEmail(email)) {
      throw new InvalidEmailFormatError(email);
    }

    const isEmailDuplicate = await this.isEmailDuplicate(email);
    const user = await this.createUserDomainService.createUser({
      email,
      hashedPassword,
      name,
      isEmailDuplicate,
    });

    await this.userRepository.save(user);

    return user;
  }

  private async isEmailDuplicate(email: string): Promise<boolean> {
    return this.userRepository.exists(email);
  }
}
