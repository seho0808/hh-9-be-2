import { Injectable, Inject } from "@nestjs/common";
import { UserRepositoryInterface } from "../interfaces/user.repository.interface";

@Injectable()
export class UserPolicy {
  constructor(
    @Inject("UserRepositoryInterface")
    private readonly userRepository: UserRepositoryInterface
  ) {}

  async isEmailDuplicate(email: string): Promise<boolean> {
    return this.userRepository.exists(email);
  }
}
