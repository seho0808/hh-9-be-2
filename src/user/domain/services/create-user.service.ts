import { User } from "../entities/user.entity";
import {
  EmailDuplicateError,
  InvalidEmailFormatError,
  InvalidUserNameError,
} from "../exceptions/user.exceptions";

export class CreateUserDomainService {
  async createUser({
    email,
    hashedPassword,
    name,
    isEmailDuplicate,
  }: {
    email: string;
    hashedPassword: string;
    name: string;
    isEmailDuplicate: () => Promise<boolean>;
  }): Promise<User> {
    if (!User.isValidEmail(email)) {
      throw new InvalidEmailFormatError(email);
    }

    if (await isEmailDuplicate()) {
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

    return user;
  }
}
