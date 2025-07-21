import { Test, TestingModule } from "@nestjs/testing";
import { CreateUserUseCase, CreateUserCommand } from "./create-user.use-case";
import { UserRepositoryInterface } from "../../domain/interfaces/user.repository.interface";
import { User } from "../../domain/entities/user.entity";
import {
  EmailDuplicateError,
  InvalidEmailFormatError,
  InvalidUserNameError,
} from "../../domain/exceptions/user.exceptions";

describe("CreateUserUseCase", () => {
  let createUserUseCase: CreateUserUseCase;
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
        CreateUserUseCase,
        {
          provide: "UserRepositoryInterface",
          useValue: mockUserRepository,
        },
      ],
    }).compile();

    createUserUseCase = module.get<CreateUserUseCase>(CreateUserUseCase);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("execute", () => {
    const validCommand: CreateUserCommand = {
      email: "test@example.com",
      hashedPassword: "hashedPassword123",
      name: "Test User",
    };

    it("사용자를 성공적으로 생성해야 함", async () => {
      mockUserRepository.exists.mockResolvedValue(false);
      const createdUser = User.create({
        email: validCommand.email,
        password: validCommand.hashedPassword,
        name: validCommand.name,
      });
      mockUserRepository.save.mockResolvedValue(createdUser);

      const result = await createUserUseCase.execute(validCommand);

      expect(result).toEqual(createdUser);
    });

    it("이메일이 중복일 때 EmailDuplicateError를 발생시켜야 함", async () => {
      mockUserRepository.exists.mockResolvedValue(true);

      await expect(createUserUseCase.execute(validCommand)).rejects.toThrow(
        EmailDuplicateError
      );
    });

    it("유효하지 않은 이메일 형식에 대해 InvalidEmailFormatError를 발생시켜야 함", async () => {
      const invalidEmailCommand: CreateUserCommand = {
        ...validCommand,
        email: "invalid-email",
      };

      mockUserRepository.exists.mockResolvedValue(false);

      await expect(
        createUserUseCase.execute(invalidEmailCommand)
      ).rejects.toThrow(InvalidEmailFormatError);
    });

    it("리포지토리 저장 오류를 처리해야 함", async () => {
      mockUserRepository.exists.mockResolvedValue(false);
      const error = new Error("Database save failed");
      mockUserRepository.save.mockRejectedValue(error);

      await expect(createUserUseCase.execute(validCommand)).rejects.toThrow(
        error
      );
    });

    it("정책 검사 오류를 처리해야 함", async () => {
      const error = new Error("Policy check failed");
      mockUserRepository.exists.mockRejectedValue(error);

      await expect(createUserUseCase.execute(validCommand)).rejects.toThrow(
        error
      );
    });

    it("유효하지 않은 사용자 이름에 대해 InvalidUserNameError를 발생시켜야 함", async () => {
      const invalidNameCommand: CreateUserCommand = {
        ...validCommand,
        name: "a", // 너무 짧음
      };

      mockUserRepository.exists.mockResolvedValue(false);

      await expect(
        createUserUseCase.execute(invalidNameCommand)
      ).rejects.toThrow(InvalidUserNameError);
    });

    it("금지된 사용자 이름에 대해 InvalidUserNameError를 발생시켜야 함", async () => {
      const forbiddenNameCommand: CreateUserCommand = {
        ...validCommand,
        name: "admin",
      };

      mockUserRepository.exists.mockResolvedValue(false);

      await expect(
        createUserUseCase.execute(forbiddenNameCommand)
      ).rejects.toThrow(InvalidUserNameError);
    });
  });
});
