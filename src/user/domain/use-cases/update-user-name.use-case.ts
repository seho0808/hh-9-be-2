import { Injectable, Inject } from "@nestjs/common";
import { UserRepositoryInterface } from "@/user/domain/interfaces/user.repository.interface";
import { User } from "@/user/domain/entities/user.entity";
import {
  UserNotFoundError,
  InvalidUserNameError,
} from "@/user/domain/exceptions/user.exceptions";

export interface UpdateUserNameCommand {
  userId: string;
  newName: string;
}

@Injectable()
export class UpdateUserNameUseCase {
  constructor(
    @Inject("UserRepositoryInterface")
    private readonly userRepository: UserRepositoryInterface
  ) {}

  async execute(command: UpdateUserNameCommand): Promise<User> {
    const { userId, newName } = command;

    if (!User.isValidUserName(newName)) {
      throw new InvalidUserNameError(newName);
    }

    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new UserNotFoundError(userId);
    }

    user.updateName(newName);

    return this.userRepository.save(user);
  }
}
