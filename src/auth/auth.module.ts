import { Module, forwardRef } from "@nestjs/common";
import { AuthController } from "./auth.controller";
import { AuthMockService } from "./services/auth.mock.service";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { UserModule } from "src/user/user.module";

@Module({
  imports: [forwardRef(() => UserModule)],
  controllers: [AuthController],
  providers: [AuthMockService, JwtAuthGuard],
  exports: [AuthMockService, JwtAuthGuard],
})
export class AuthModule {}
