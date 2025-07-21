import { Test, TestingModule } from "@nestjs/testing";
import { GetUserByEmailUseCase } from "./get-user-by-email.use-case";
import { UserRepositoryInterface } from "../../domain/interfaces/user.repository.interface";
import { User } from "../../domain/entities/user.entity";

describe("GetUserByEmailUseCase", () => {
  let getUserByEmailUseCase: GetUserByEmailUseCase;
  let mockUserRepository: jest.Mocked<UserRepositoryInterface>;

  beforeEach(async () => {
    mockUserRepository = {
      findById: jest.fn(),
      findByEmail: jest.fn(),
      save: jest.fn(),
      exists: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetUserByEmailUseCase,
        {
          provide: "UserRepositoryInterface",
          useValue: mockUserRepository,
        },
      ],
    }).compile();

    getUserByEmailUseCase = module.get<GetUserByEmailUseCase>(
      GetUserByEmailUseCase
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("execute", () => {
    const email = "test@example.com";

    it("사용자를 찾았을 때 사용자를 반환해야 함", async () => {
      const user = User.create({
        email,
        password: "hashedPassword",
        name: "Test User",
      });

      mockUserRepository.findByEmail.mockResolvedValue(user);

      const result = await getUserByEmailUseCase.execute(email);

      expect(result).toEqual(user);
    });

    it("사용자를 찾지 못했을 때 null을 반환해야 함", async () => {
      mockUserRepository.findByEmail.mockResolvedValue(null);

      const result = await getUserByEmailUseCase.execute(email);

      expect(result).toBeNull();
    });

    it("리포지토리 오류를 처리해야 함", async () => {
      const error = new Error("Database connection failed");
      mockUserRepository.findByEmail.mockRejectedValue(error);

      await expect(getUserByEmailUseCase.execute(email)).rejects.toThrow(error);
    });

    it("빈 이메일 문자열을 처리해야 함", async () => {
      const emptyEmail = "";
      mockUserRepository.findByEmail.mockResolvedValue(null);

      const result = await getUserByEmailUseCase.execute(emptyEmail);

      expect(result).toBeNull();
    });

    it("이메일의 특수문자를 처리해야 함", async () => {
      const specialEmail = "user+test@example.com";
      const user = User.create({
        email: specialEmail,
        password: "hashedPassword",
        name: "Test User",
      });

      mockUserRepository.findByEmail.mockResolvedValue(user);

      const result = await getUserByEmailUseCase.execute(specialEmail);

      expect(result).toEqual(user);
    });
  });
});
