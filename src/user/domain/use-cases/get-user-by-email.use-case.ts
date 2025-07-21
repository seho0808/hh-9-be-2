import { Injectable, Inject } from "@nestjs/common";
import { UserRepositoryInterface } from "@/user/domain/interfaces/user.repository.interface";
import { User } from "@/user/domain/entities/user.entity";

@Injectable()
export class GetUserByEmailUseCase {
  constructor(
    @Inject("UserRepositoryInterface")
    private readonly userRepository: UserRepositoryInterface
  ) {}

  async execute(email: string): Promise<User | null> {
    return this.userRepository.findByEmail(email);
  }
}
