import { Module, forwardRef } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { UserController } from "./presentation/http/user.controller";
import { UserRepository } from "./infrastructure/persistence/user.repository";
import { UserTypeOrmEntity } from "./infrastructure/persistence/orm/user.typeorm.entity";
import { GetUserByIdUseCase } from "./application/use-cases/tier-1-in-domain/get-user-by-id.use-case";
import { GetUserByEmailUseCase } from "./application/use-cases/tier-1-in-domain/get-user-by-email.use-case";
import { CreateUserUseCase } from "./application/use-cases/tier-1-in-domain/create-user.use-case";
import { AuthModule } from "@/auth/auth.module";
import { WalletModule } from "@/wallet/wallet.module";
import { ValidateUserService } from "./domain/services/validate-user.service";
import { CreateUserUseCaseWithBalanceUseCase } from "./application/use-cases/tier-2/create-user-with-balance.use-case";

@Module({
  imports: [
    TypeOrmModule.forFeature([UserTypeOrmEntity]),
    forwardRef(() => AuthModule),
    WalletModule,
  ],
  controllers: [UserController],
  providers: [
    GetUserByIdUseCase,
    GetUserByEmailUseCase,
    CreateUserUseCaseWithBalanceUseCase,
    CreateUserUseCase,
    ValidateUserService,
    UserRepository,
  ],
  exports: [CreateUserUseCase, GetUserByEmailUseCase],
})
export class UserModule {}
