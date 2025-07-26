import { ProductTypeOrmEntity } from "../orm/product.typeorm.entity";
import {
  createEntityFactory,
  getBaseProps,
} from "../../../../common/factories/base.factory";
import {
  TEST_FACTORY_DEFAULTS,
  createTestName,
  createTestDescription,
} from "./constants";

export const ProductFactory = createEntityFactory<ProductTypeOrmEntity>(
  (options, counter) => {
    const timestamp = Date.now();
    const baseProps = getBaseProps();

    const product = new ProductTypeOrmEntity();
    Object.assign(product, {
      ...baseProps,
      name: options.name || createTestName("상품", timestamp, counter),
      description:
        options.description ||
        createTestDescription("상품", timestamp, counter),
      price: options.price ?? TEST_FACTORY_DEFAULTS.PRODUCT.PRICE,
      totalStock:
        options.totalStock ?? TEST_FACTORY_DEFAULTS.PRODUCT.TOTAL_STOCK,
      reservedStock:
        options.reservedStock ?? TEST_FACTORY_DEFAULTS.PRODUCT.RESERVED_STOCK,
      isActive: options.isActive ?? TEST_FACTORY_DEFAULTS.PRODUCT.IS_ACTIVE,
      ...options,
    });

    return product;
  }
);
