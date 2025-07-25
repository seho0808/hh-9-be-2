import { Module, forwardRef } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { UserController } from "./infrastructure/http/user.controller";
import { UserApplicationService } from "./application/services/user.service";
import { UserRepository } from "./infrastructure/persistence/user.repository";
import { UserTypeOrmEntity } from "./infrastructure/persistence/orm/user.typeorm.entity";
import { GetUserByIdUseCase } from "./domain/use-cases/get-user-by-id.use-case";
import { GetUserByEmailUseCase } from "./domain/use-cases/get-user-by-email.use-case";
import { CreateUserUseCase } from "./domain/use-cases/create-user.use-case";
import { AuthModule } from "@/auth/auth.module";
import { WalletModule } from "@/wallet/wallet.module";
import { TransactionService } from "@/common/services/transaction.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([UserTypeOrmEntity]),
    forwardRef(() => AuthModule),
    forwardRef(() => WalletModule),
  ],
  controllers: [UserController],
  providers: [
    TransactionService,
    UserApplicationService,
    GetUserByIdUseCase,
    GetUserByEmailUseCase,
    CreateUserUseCase,
    {
      provide: "UserRepositoryInterface",
      useClass: UserRepository,
    },
  ],
  exports: [UserApplicationService],
})
export class UserModule {}
