import "reflect-metadata";
import { DataSource } from "typeorm";
import { ProductTypeOrmEntity } from "../../src/product/infrastructure/persistence/orm/product.typeorm.entity";

const dataSource = new DataSource({
  type: "mysql",
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "3306"),
  username: process.env.DB_USERNAME || "root",
  password: process.env.DB_PASSWORD || "root",
  database: process.env.DB_DATABASE || "testdb",
  entities: [ProductTypeOrmEntity],
  synchronize: false,
  logging: true,
});

async function ensurePrimarySkuStock(
  productId: string,
  desiredTotalStock: number
) {
  const repo = dataSource.getRepository(ProductTypeOrmEntity);
  const product = await repo.findOne({ where: { id: productId } });
  if (!product) {
    throw new Error(`Product not found: ${productId}`);
  }

  if (product.totalStock !== desiredTotalStock) {
    product.totalStock = desiredTotalStock;
    await repo.save(product);
    console.log(`✅ Updated ${productId} totalStock -> ${desiredTotalStock}`);
  } else {
    console.log(`ℹ️  ${productId} already has totalStock=${desiredTotalStock}`);
  }
}

async function main() {
  const PRODUCT_ID = process.env.PRODUCT_ID || "cache-test-product-1";
  const TOTAL_STOCK = parseInt(process.env.TOTAL_STOCK || "1000000");

  try {
    console.log("🚀 Starting order-test seed...");
    await dataSource.initialize();
    console.log("📅 Database connected");

    await ensurePrimarySkuStock(PRODUCT_ID, TOTAL_STOCK);

    console.log("🎉 Order-test seed completed successfully!");
  } catch (err) {
    console.error("❌ Seed error:", err);
    process.exit(1);
  } finally {
    await dataSource.destroy();
  }
}

if (require.main === module) {
  main();
}
