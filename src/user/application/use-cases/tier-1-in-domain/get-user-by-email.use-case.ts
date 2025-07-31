import { Injectable } from "@nestjs/common";
import { User } from "@/user/domain/entities/user.entity";
import { UserRepository } from "@/user/infrastructure/persistence/user.repository";

@Injectable()
export class GetUserByEmailUseCase {
  constructor(private readonly userRepository: UserRepository) {}

  async execute(email: string): Promise<User | null> {
    return this.userRepository.findByEmail(email);
  }
}
