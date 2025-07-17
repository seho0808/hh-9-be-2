import { Module } from "@nestjs/common";
import { WalletController } from "./wallet.controller";
import { WalletMockService } from "./services/wallet.mock.service";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [AuthModule],
  controllers: [WalletController],
  providers: [WalletMockService],
  exports: [WalletMockService],
})
export class WalletModule {}
