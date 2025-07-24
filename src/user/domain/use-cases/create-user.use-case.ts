import { Injectable, Inject } from "@nestjs/common";
import { UserRepositoryInterface } from "@/user/domain/interfaces/user.repository.interface";
import { User } from "@/user/domain/entities/user.entity";
import {
  EmailDuplicateError,
  InvalidEmailFormatError,
  InvalidUserNameError,
} from "@/user/domain/exceptions/user.exceptions";

export interface CreateUserCommand {
  email: string;
  hashedPassword: string;
  name: string;
}

@Injectable()
export class CreateUserUseCase {
  constructor(
    @Inject("UserRepositoryInterface")
    private readonly userRepository: UserRepositoryInterface
  ) {}

  async execute(command: CreateUserCommand): Promise<User> {
    const { email, hashedPassword, name } = command;

    if (!User.isValidEmail(email)) {
      throw new InvalidEmailFormatError(email);
    }

    const isDuplicate = await this.isEmailDuplicate(email);
    if (isDuplicate) {
      throw new EmailDuplicateError(email);
    }

    if (!User.isValidUserName(name)) {
      throw new InvalidUserNameError(name);
    }

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
