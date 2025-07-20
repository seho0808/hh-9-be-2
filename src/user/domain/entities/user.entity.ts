export interface UserProps {
  id: string;
  email: string;
  password: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

export class User {
  private constructor(private readonly props: UserProps) {}

  static create(
    props: Omit<UserProps, "id" | "createdAt" | "updatedAt">
  ): User {
    const now = new Date();
    return new User({
      ...props,
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
    });
  }

  updateName(name: string): void {
    this.props.name = name;
    this.props.updatedAt = new Date();
  }

  updatePassword(hashedPassword: string): void {
    this.props.password = hashedPassword;
    this.props.updatedAt = new Date();
  }

  static fromPersistence(props: UserProps): User {
    return new User(props);
  }

  toPersistence(): UserProps {
    return { ...this.props };
  }

  static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  static isValidUserName(name: string): boolean {
    if (!name || name.trim().length < 2) {
      return false;
    }

    const forbiddenWords = ["admin", "root", "system"];
    const lowerName = name.toLowerCase();

    return !forbiddenWords.some((word) => lowerName.includes(word));
  }

  get id(): string {
    return this.props.id;
  }

  get email(): string {
    return this.props.email;
  }

  get password(): string {
    return this.props.password;
  }

  get name(): string {
    return this.props.name;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }
}
