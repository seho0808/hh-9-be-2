import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseFilters,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse } from "@nestjs/swagger";
import { AuthService } from "../services/auth.service";
import { LoginDto, LoginResponseDto } from "../dto/login.dto";
import { RegisterDto, RegisterResponseDto } from "../dto/register.dto";
import { ApiResponseDto } from "@/common/presentation/dto/response.dto";
import { AuthExceptionFilter } from "../filters/auth-exception.filter";

@ApiTags("인증")
@Controller("auth")
@UseFilters(AuthExceptionFilter)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("signup")
  @ApiOperation({ summary: "회원가입" })
  @ApiResponse({
    status: 201,
    description: "회원가입 성공",
    type: RegisterResponseDto,
  })
  @ApiResponse({
    status: 409,
    description: "이메일 중복",
  })
  async register(
    @Body() registerDto: RegisterDto
  ): Promise<ApiResponseDto<RegisterResponseDto>> {
    const result = await this.authService.register(registerDto);
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
