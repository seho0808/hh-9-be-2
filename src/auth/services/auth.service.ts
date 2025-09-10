import {
  Injectable,
  ConflictException,
  UnauthorizedException,
} from "@nestjs/common";
import { User } from "@/user/domain/entities/user.entity";
import { AuthJwtService, JwtPayload } from "./jwt.service";
import { LoginDto, LoginResponseDto } from "../dto/login.dto";
import { RegisterDto, RegisterResponseDto } from "../dto/register.dto";
import * as bcrypt from "bcrypt";
import { GetUserByEmailUseCase } from "@/user/application/use-cases/tier-1-in-domain/get-user-by-email.use-case";
import { CreateUserUseCaseWithBalanceUseCase } from "@/user/application/use-cases/tier-2/create-user-with-balance.use-case";

@Injectable()
export class AuthService {
  constructor(
    private readonly createUserUseCaseWithBalanceUseCase: CreateUserUseCaseWithBalanceUseCase,
    private readonly getUserByEmailUseCase: GetUserByEmailUseCase,
    private readonly authJwtService: AuthJwtService
  ) {}

  async register(registerDto: RegisterDto): Promise<RegisterResponseDto> {
    const { email, password, name } = registerDto;

    if (!this.isPasswordValidFormat(password)) {
      throw new UnauthorizedException("비밀번호 형식이 올바르지 않습니다");
    }

    const hashedPassword = await this.hashPassword(password);

    const user = await this.createUserUseCaseWithBalanceUseCase.execute({
      email,
      hashedPassword,
      name,
    });

    return this.userToRegisterResponseDto(user);
  }

  async login(loginDto: LoginDto): Promise<LoginResponseDto> {
    const { email, password } = loginDto;

    const user = await this.getUserByEmailUseCase.execute(email);
    if (!user) {
      throw new UnauthorizedException("이메일 또는 비밀번호가 잘못되었습니다");
    }

    if (!this.isPasswordMatching(password, user.password)) {
      throw new UnauthorizedException("이메일 또는 비밀번호가 잘못되었습니다");
    }

    const payload: JwtPayload = {
      id: user.id,
      email: user.email,
      name: user.name,
    };

    const accessToken = this.authJwtService.generateAccessToken(payload);

    return {
      accessToken,
      tokenType: "Bearer",
      expiresIn: this.authJwtService.getTokenExpiresIn(),
      user: this.userToUserInfoDto(user),
    };
  }

  private isPasswordValidFormat(password: string): boolean {
    const passwordRegex =
      /^(?=.*[a-zA-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    return passwordRegex.test(password);
  }

  private isPasswordMatching(
    password: string,
    hashedPassword: string
  ): boolean {
    return bcrypt.compareSync(password, hashedPassword);
  }

  private async hashPassword(password: string): Promise<string> {
    return await bcrypt.hash(password, 10);
  }

  private userToRegisterResponseDto(user: User): RegisterResponseDto {
    return {
      accessToken: this.authJwtService.generateAccessToken(
        this.userToUserInfoDto(user)
      ),
      tokenType: "Bearer",
      expiresIn: this.authJwtService.getTokenExpiresIn(),
      user: this.userToUserInfoDto(user),
    };
  }

  private userToUserInfoDto(user: User) {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
