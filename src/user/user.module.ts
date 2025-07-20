import { Module, forwardRef } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { UserController } from "./infrastructure/http/user.controller";
import { UserApplicationService } from "./application/services/user.service";
import { UserRepository } from "./infrastructure/persistence/user.repository";
import { UserTypeOrmEntity } from "./infrastructure/persistence/orm/user.typeorm.entity";
import { UserPolicy } from "./domain/policies/user.policy";
import { GetUserByIdUseCase } from "./application/use-cases/get-user-by-id.use-case";
import { GetUserByEmailUseCase } from "./application/use-cases/get-user-by-email.use-case";
import { CreateUserUseCase } from "./application/use-cases/create-user.use-case";
import { UpdateUserNameUseCase } from "./application/use-cases/update-user-name.use-case";
import { AuthModule } from "@/auth/auth.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([UserTypeOrmEntity]),
    forwardRef(() => AuthModule),
  ],
  controllers: [UserController],
  providers: [
    UserApplicationService,
    UserPolicy,
    GetUserByIdUseCase,
    GetUserByEmailUseCase,
    CreateUserUseCase,
    UpdateUserNameUseCase,
    {
      provide: "UserRepositoryInterface",
      useClass: UserRepository,
    },
  ],
  exports: [UserApplicationService],
})
export class UserModule {}
