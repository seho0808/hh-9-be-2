import { User } from "../entities/user.entity";
import {
  EmailDuplicateError,
  InvalidEmailFormatError,
  InvalidUserNameError,
} from "../exceptions/user.exceptions";

export class ValidateUserService {
  async validateUser({
    email,
    name,
    isEmailDuplicate,
  }: {
    email: string;
    name: string;
    isEmailDuplicate: () => Promise<boolean>;
  }): Promise<void> {
    if (!User.isValidEmail(email)) {
      throw new InvalidEmailFormatError(email);
    }

    if (await isEmailDuplicate()) {
      throw new EmailDuplicateError(email);
    }

    if (!User.isValidUserName(name)) {
      throw new InvalidUserNameError(name);
    }
  }
}
