import { Module } from "@nestjs/common";
import { UserController } from "./user.controller";
import { UserMockService } from "./services/user.mock.service";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [AuthModule],
  controllers: [UserController],
  providers: [UserMockService],
  exports: [UserMockService],
})
export class UserModule {}
