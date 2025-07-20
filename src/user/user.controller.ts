import { Controller, Post, Get, Body, UseGuards } from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from "@nestjs/swagger";
import { UserMockService } from "./services/user.mock.service";
import { UserResponseDto } from "./dto/user.dto";
import { ApiResponseDto } from "../common/dto/response.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import {
  CurrentUser,
  CurrentUserData,
} from "../common/decorators/current-user.decorator";

@ApiTags("사용자")
@Controller("users")
export class UserController {
  constructor(private readonly userService: UserMockService) {}

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
    const result = await this.userService.findUserById(user.id);
    return ApiResponseDto.success(result, "사용자 정보 조회에 성공했습니다");
  }
}
