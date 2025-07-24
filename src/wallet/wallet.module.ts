import { Module, forwardRef } from "@nestjs/common";
import { WalletController } from "./infrastructure/http/wallet.controller";
import { AuthModule } from "../auth/auth.module";
import { TransactionService } from "../common/services/transaction.service";
import { UserBalanceRepository } from "./infrastructure/persistence/use-balance.repository";
import { PointTransactionRepository } from "./infrastructure/persistence/point-transaction.repository";
import { WalletApplicationService } from "./application/wallet.service";
import { ChargePointsUseCase } from "./domain/use-cases/charge-points.use-case";
import { RecoverPointsUseCase } from "./domain/use-cases/recover-points.use-case";
import { UsePointsUseCase } from "./domain/use-cases/use-points.use-case";
import { GetUserPointsUseCase } from "./domain/use-cases/get-user-points.use-case";
import { CreateUserBalanceUseCase } from "./domain/use-cases/create-user-balance.use-case";
import { ValidateUsePointsUseCase } from "./domain/use-cases/validate-use-points.use-case";
import { UserBalanceTypeOrmEntity } from "./infrastructure/persistence/orm/user-balance.typeorm.entity";
import { PointTransactionTypeOrmEntity } from "./infrastructure/persistence/orm/point-transaction.typeorm.entity";
import { TypeOrmModule } from "@nestjs/typeorm";

@Module({
  imports: [
    forwardRef(() => AuthModule),
    TypeOrmModule.forFeature([
      UserBalanceTypeOrmEntity,
      PointTransactionTypeOrmEntity,
    ]),
  ],
  controllers: [WalletController],
  providers: [
    TransactionService,
    WalletApplicationService,
    ChargePointsUseCase,
    RecoverPointsUseCase,
    UsePointsUseCase,
    GetUserPointsUseCase,
    CreateUserBalanceUseCase,
    ValidateUsePointsUseCase,
    {
      provide: "UserBalanceRepositoryInterface",
      useClass: UserBalanceRepository,
    },
    {
      provide: "PointTransactionRepositoryInterface",
      useClass: PointTransactionRepository,
    },
  ],
  exports: [WalletApplicationService],
})
export class WalletModule {}
