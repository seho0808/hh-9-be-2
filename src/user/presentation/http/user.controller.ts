import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  UseFilters,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from "@nestjs/swagger";
import { UserResponseDto } from "@/user/presentation/http/dto/user.dto";
import { ApiResponseDto } from "@/common/presentation/dto/response.dto";
import { JwtAuthGuard } from "@/auth/guards/jwt-auth.guard";
import {
  CurrentUser,
  CurrentUserData,
} from "@/common/decorators/current-user.decorator";
import { UserExceptionFilter } from "./filters/user-exception.filter";
import { GetUserByIdUseCase } from "@/user/application/use-cases/tier-1-in-domain/get-user-by-id.use-case";

@ApiTags("사용자")
@Controller("users")
@UseFilters(UserExceptionFilter)
export class UserController {
  constructor(private readonly getUserByIdUseCase: GetUserByIdUseCase) {}

  @Get("me")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth("access-token")
  @ApiOperation({ summary: "내 정보 조회" })
  @ApiResponse({
    status: 200,
    description: "사용자 정보 조회 성공",
    type: UserResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: "인증 필요",
  })
  async getMyInfo(
    @CurrentUser() user: CurrentUserData
  ): Promise<ApiResponseDto<UserResponseDto>> {
    const result = await this.getUserByIdUseCase.execute(user.id);
    return ApiResponseDto.success(
      UserResponseDto.fromEntity(result),
      "사용자 정보 조회에 성공했습니다"
    );
  }
}
