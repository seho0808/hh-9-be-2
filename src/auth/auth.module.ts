import { Module } from "@nestjs/common";
import { AuthController } from "./auth.controller";
import { AuthMockService } from "./services/auth.mock.service";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";

@Module({
  controllers: [AuthController],
  providers: [AuthMockService, JwtAuthGuard],
  exports: [AuthMockService, JwtAuthGuard],
})
export class AuthModule {}
