import { Controller, Post, Body, HttpCode, HttpStatus } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse } from "@nestjs/swagger";
import { AuthMockService } from "./services/auth.mock.service";
import { LoginDto } from "./dto/login.dto";
import { RegisterDto } from "./dto/register.dto";
import { LoginResponseDto } from "./dto/auth-response.dto";
import { ApiResponseDto } from "../common/dto/response.dto";
import { UserResponseDto } from "src/user/dto/user.dto";
import { UserMockService } from "src/user/services/user.mock.service";

@ApiTags("인증")
@Controller("auth")
export class AuthController {
  constructor(
    private readonly authService: AuthMockService,
    private readonly userService: UserMockService
  ) {}

  @Post("signup")
  @ApiOperation({ summary: "회원가입" })
  @ApiResponse({
    status: 201,
    description: "회원가입 성공",
    type: UserResponseDto,
  })
  @ApiResponse({
    status: 409,
    description: "이메일 중복",
  })
  async register(
    @Body() registerDto: RegisterDto
  ): Promise<ApiResponseDto<UserResponseDto>> {
    const result = await this.userService.createUser(registerDto);
    return ApiResponseDto.success(result, "회원가입이 완료되었습니다");
  }

  @Post("login")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "로그인" })
  @ApiResponse({
    status: 200,
    description: "로그인 성공",
    type: LoginResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: "인증 실패",
  })
  async login(
    @Body() loginDto: LoginDto
  ): Promise<ApiResponseDto<LoginResponseDto>> {
    const result = await this.authService.login(loginDto);
    return ApiResponseDto.success(result, "로그인에 성공했습니다");
  }

  @Post("logout")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "로그아웃" })
  @ApiResponse({
    status: 200,
    description: "로그아웃 성공",
  })
  async logout(): Promise<ApiResponseDto<null>> {
    // 실제로는 토큰을 무효화하는 로직이 필요
    return ApiResponseDto.success(null, "로그아웃되었습니다");
  }
}
