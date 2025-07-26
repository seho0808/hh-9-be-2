import {
  Injectable,
  ConflictException,
  UnauthorizedException,
} from "@nestjs/common";
import { UserApplicationService } from "@/user/application/services/user.service";
import { User } from "@/user/domain/entities/user.entity";
import { AuthJwtService, JwtPayload } from "./jwt.service";
import { LoginDto, LoginResponseDto } from "../dto/login.dto";
import { RegisterDto, RegisterResponseDto } from "../dto/register.dto";
import * as bcrypt from "bcrypt";

@Injectable()
export class AuthService {
  constructor(
    private readonly userApplicationService: UserApplicationService,
    private readonly authJwtService: AuthJwtService
  ) {}

  async register(registerDto: RegisterDto): Promise<RegisterResponseDto> {
    const { email, password, name } = registerDto;

    if (await this.userApplicationService.checkEmailExists(email)) {
      throw new ConflictException("이미 존재하는 이메일입니다");
    }

    if (!this.isPasswordValidFormat(password)) {
      throw new UnauthorizedException("비밀번호 형식이 올바르지 않습니다");
    }

    const hashedPassword = this.hashPassword(password);

    const user = await this.userApplicationService.createUser({
      email,
      hashedPassword,
      name,
    });

    return this.userToRegisterResponseDto(user);
  }

  async login(loginDto: LoginDto): Promise<LoginResponseDto> {
    const { email, password } = loginDto;

    const user = await this.userApplicationService.getUserByEmail(email);
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

  private hashPassword(password: string): string {
    return bcrypt.hashSync(password, 10);
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
