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
import { UserApplicationService } from "@/user/application/services/user.service";
import { UserResponseDto } from "@/user/infrastructure/http/dto/user.dto";
import { ApiResponseDto } from "@/common/dto/response.dto";
import { JwtAuthGuard } from "@/auth/guards/jwt-auth.guard";
import {
  CurrentUser,
  CurrentUserData,
} from "@/common/decorators/current-user.decorator";
import { User } from "@/user/domain/entities/user.entity";
import { UserExceptionFilter } from "./filters/user-exception.filter";

@ApiTags("사용자")
@Controller("users")
@UseFilters(UserExceptionFilter)
export class UserController {
  constructor(
    private readonly userApplicationService: UserApplicationService
  ) {}

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
    const result = await this.userApplicationService.getUserById(user.id);
    return ApiResponseDto.success(
      this.userToUserResponseDto(result),
      "사용자 정보 조회에 성공했습니다"
    );
  }

  private userToUserResponseDto(user: User): UserResponseDto {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
