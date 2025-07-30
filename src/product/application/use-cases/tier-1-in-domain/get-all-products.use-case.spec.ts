import { Test, TestingModule } from "@nestjs/testing";
import { GetAllProductsUseCase } from "./get-all-products.use-case";
import { ProductRepositoryInterface } from "@/product/domain/interfaces/product.repository.interface";

jest.mock("typeorm-transactional", () => ({
  Transactional: () => () => ({}),
}));

describe("GetAllProductsUseCase", () => {
  let useCase: GetAllProductsUseCase;
  let productRepository: jest.Mocked<ProductRepositoryInterface>;

  beforeEach(async () => {
    const mockProductRepository = {
      findPaginated: jest.fn(),
      findById: jest.fn(),
      findByName: jest.fn(),
      save: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetAllProductsUseCase,
        {
          provide: "ProductRepositoryInterface",
          useValue: mockProductRepository,
        },
      ],
    }).compile();

    useCase = module.get<GetAllProductsUseCase>(GetAllProductsUseCase);
    productRepository = module.get("ProductRepositoryInterface");
  });

  describe("정상적인 페이지네이션 조회", () => {
    it("페이지네이션 기본 동작 및 엣지케이스: page/limit 기본값, undefined", async () => {
      const cases = [
        {
          page: 1,
          limit: 3,
          total: 10,
          expectedPage: 1,
          expectedLimit: 3,
          expectedTotalPages: 4,
        },
        {
          page: undefined,
          limit: undefined,
          total: 30,
          expectedPage: 1,
          expectedLimit: 10,
          expectedTotalPages: 3,
        },
      ];

      for (const {
        page,
        limit,
        total,
        expectedPage,
        expectedLimit,
        expectedTotalPages,
      } of cases) {
        productRepository.findPaginated.mockResolvedValue({
          products: [],
          total,
        });

        const result = await useCase.execute({ page, limit });

        expect(result.page).toBe(expectedPage);
        expect(result.limit).toBe(expectedLimit);
        expect(result.totalPages).toBe(expectedTotalPages);
      }
    });
  });
});
