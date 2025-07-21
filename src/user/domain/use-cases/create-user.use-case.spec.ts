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

      const result = await createUserUseCase.execute(validCommand);

      expect(result).toBeInstanceOf(User);
      expect(result.email).toBe(validCommand.email);
      expect(result.password).toBe(validCommand.hashedPassword);
      expect(result.name).toBe(validCommand.name);
      expect(result.id).toBeDefined();
      expect(result.createdAt).toBeInstanceOf(Date);
      expect(result.updatedAt).toBeInstanceOf(Date);

      expect(mockUserRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          email: validCommand.email,
          password: validCommand.hashedPassword,
          name: validCommand.name,
        })
      );
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

    it.each([
      { name: "a", description: "너무 짧음" },
      { name: "admin", description: "금지된 이름" },
      { name: "", description: "빈 문자열" },
      { name: "  ", description: "공백만 있음" },
    ])(
      "유효하지 않은 사용자 이름(%s)에 대해 InvalidUserNameError를 발생시켜야 함",
      async ({ name, description }) => {
        const invalidNameCommand: CreateUserCommand = {
          ...validCommand,
          name,
        };

        mockUserRepository.exists.mockResolvedValue(false);

        await expect(
          createUserUseCase.execute(invalidNameCommand)
        ).rejects.toThrow(InvalidUserNameError);
      }
    );
  });
});
