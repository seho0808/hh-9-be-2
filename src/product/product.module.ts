import { Module } from "@nestjs/common";
import { ProductController } from "./product.controller";
import { ProductMockService } from "./services/product.mock.service";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [AuthModule],
  controllers: [ProductController],
  providers: [ProductMockService],
  exports: [ProductMockService],
})
export class ProductModule {}
