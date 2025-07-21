import { Test, TestingModule } from "@nestjs/testing";
import { GetUserByIdUseCase } from "./get-user-by-id.use-case";
import { UserRepositoryInterface } from "../../domain/interfaces/user.repository.interface";
import { User } from "../../domain/entities/user.entity";
import { UserNotFoundError } from "../../domain/exceptions/user.exceptions";

describe("GetUserByIdUseCase", () => {
  let getUserByIdUseCase: GetUserByIdUseCase;
  let mockUserRepository: jest.Mocked<UserRepositoryInterface>;

  beforeEach(async () => {
    mockUserRepository = {
      findById: jest.fn(),
      findByEmail: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      exists: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetUserByIdUseCase,
        {
          provide: "UserRepositoryInterface",
          useValue: mockUserRepository,
        },
      ],
    }).compile();

    getUserByIdUseCase = module.get<GetUserByIdUseCase>(GetUserByIdUseCase);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("execute", () => {
    const userId = "test-user-id";

    it("사용자를 찾았을 때 사용자를 반환해야 함", async () => {
      const user = User.create({
        email: "test@example.com",
        password: "hashedPassword",
        name: "Test User",
      });

      mockUserRepository.findById.mockResolvedValue(user);

      const result = await getUserByIdUseCase.execute(userId);

      expect(result).toEqual(user);
    });

    it("사용자를 찾지 못했을 때 UserNotFoundError를 발생시켜야 함", async () => {
      mockUserRepository.findById.mockResolvedValue(null);

      await expect(getUserByIdUseCase.execute(userId)).rejects.toThrow(
        UserNotFoundError
      );
    });

    it("리포지토리 오류를 처리해야 함", async () => {
      const error = new Error("Database connection failed");
      mockUserRepository.findById.mockRejectedValue(error);

      await expect(getUserByIdUseCase.execute(userId)).rejects.toThrow(error);
    });

    it("빈 사용자 ID를 처리해야 함", async () => {
      const emptyUserId = "";
      mockUserRepository.findById.mockResolvedValue(null);

      await expect(getUserByIdUseCase.execute(emptyUserId)).rejects.toThrow(
        UserNotFoundError
      );

      expect(mockUserRepository.findById).toHaveBeenCalledWith(emptyUserId);
    });

    it("UUID 형식의 사용자 ID를 처리해야 함", async () => {
      const uuidUserId = "550e8400-e29b-41d4-a716-446655440000";
      const user = User.create({
        email: "test@example.com",
        password: "hashedPassword",
        name: "Test User",
      });

      mockUserRepository.findById.mockResolvedValue(user);

      const result = await getUserByIdUseCase.execute(uuidUserId);

      expect(result).toEqual(user);
      expect(mockUserRepository.findById).toHaveBeenCalledWith(uuidUserId);
    });
  });
});
