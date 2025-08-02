import { Injectable } from "@nestjs/common";
import { User } from "@/user/domain/entities/user.entity";
import { UserNotFoundError } from "@/user/domain/exceptions/user.exceptions";
import { UserRepository } from "@/user/infrastructure/persistence/user.repository";

@Injectable()
export class GetUserByIdUseCase {
  constructor(private readonly userRepository: UserRepository) {}

  async execute(userId: string): Promise<User> {
    const user = await this.userRepository.findById(userId);

    if (!user) {
      throw new UserNotFoundError(userId);
    }

    return user;
  }
}
