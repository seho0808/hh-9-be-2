import { TypeOrmModule } from "@nestjs/typeorm";

export const mysqlModule = TypeOrmModule.forRoot({
  type: "mysql",
  host: "localhost",
  port: 3306,
  database: "testdb",
  username: "root",
  password: "root",
  logging: false,
  synchronize: false,
  autoLoadEntities: true,
  relationLoadStrategy: "join",
});
