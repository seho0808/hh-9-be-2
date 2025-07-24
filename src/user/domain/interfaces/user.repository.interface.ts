import { User } from "../entities/user.entity";

export interface UserRepositoryInterface {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  save(user: User): Promise<User>;
  exists(email: string): Promise<boolean>;
}
