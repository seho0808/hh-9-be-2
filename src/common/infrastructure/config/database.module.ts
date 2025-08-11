import { Module } from "@nestjs/common";
import { mysqlModule } from "./mysql.config";

@Module({
  imports: [mysqlModule],
  controllers: [],
  providers: [],
})
export class DatabaseModule {}
