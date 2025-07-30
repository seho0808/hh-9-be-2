import { Module, forwardRef } from "@nestjs/common";
import { WalletController } from "./infrastructure/http/wallet.controller";
import { AuthModule } from "../auth/auth.module";
import { UserBalanceRepository } from "./infrastructure/persistence/use-balance.repository";
import { PointTransactionRepository } from "./infrastructure/persistence/point-transaction.repository";
import { ChargePointsUseCase } from "./application/use-cases/tier-1-in-domain/charge-points.use-case";
import { RecoverPointsUseCase } from "./application/use-cases/tier-1-in-domain/recover-points.use-case";
import { UsePointsUseCase } from "./application/use-cases/tier-1-in-domain/use-points.use-case";
import { GetUserPointsUseCase } from "./application/use-cases/tier-1-in-domain/get-user-points.use-case";
import { CreateUserBalanceUseCase } from "./application/use-cases/tier-1-in-domain/create-user-balance.use-case";
import { ValidateUsePointsUseCase } from "./application/use-cases/tier-1-in-domain/validate-use-points.use-case";
import { UserBalanceTypeOrmEntity } from "./infrastructure/persistence/orm/user-balance.typeorm.entity";
import { PointTransactionTypeOrmEntity } from "./infrastructure/persistence/orm/point-transaction.typeorm.entity";
import { TypeOrmModule } from "@nestjs/typeorm";
import { UsePointsDomainService } from "./domain/services/use-points.service";
import { RecoverPointsDomainService } from "./domain/services/recover-points.service";
import { CreateUserBalanceDomainService } from "./domain/services/create-user-balance.service";
import { GetUserBalanceDomainService } from "./domain/services/get-user-balance.service";
import { ValidateUsePointsDomainService } from "./domain/services/validate-use-points.service";

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
    ChargePointsUseCase,
    RecoverPointsUseCase,
    UsePointsUseCase,
    GetUserPointsUseCase,
    CreateUserBalanceUseCase,
    ValidateUsePointsUseCase,
    UsePointsDomainService,
    RecoverPointsDomainService,
    CreateUserBalanceDomainService,
    GetUserBalanceDomainService,
    ValidateUsePointsDomainService,
    {
      provide: "UserBalanceRepositoryInterface",
      useClass: UserBalanceRepository,
    },
    {
      provide: "PointTransactionRepositoryInterface",
      useClass: PointTransactionRepository,
    },
  ],
  exports: [
    ChargePointsUseCase,
    RecoverPointsUseCase,
    UsePointsUseCase,
    CreateUserBalanceUseCase,
    ValidateUsePointsUseCase,
  ],
})
export class WalletModule {}
