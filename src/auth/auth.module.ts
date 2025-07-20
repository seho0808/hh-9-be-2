import { Module, forwardRef } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { AuthController } from "./controllers/auth.controller";
import { AuthService } from "./services/auth.service";
import { AuthJwtService } from "./services/jwt.service";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { AuthExceptionFilter } from "./filters/auth-exception.filter";
import { UserModule } from "@/user/user.module";

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET || "default-secret-key",
      signOptions: { expiresIn: "1h" },
    }),
    forwardRef(() => UserModule),
  ],
  controllers: [AuthController],
  providers: [AuthService, AuthJwtService, JwtAuthGuard, AuthExceptionFilter],
  exports: [AuthService, AuthJwtService, JwtAuthGuard],
})
export class AuthModule {}
