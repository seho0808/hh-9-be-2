import { INestApplication } from "@nestjs/common";
import { DataSource } from "typeorm";
import * as request from "supertest";
import * as bcrypt from "bcrypt";
import { DEFAULT_TEST_USER } from "../constants";

export interface TestUserData {
  id?: string;
  email?: string;
  password?: string;
  name?: string;
}

export class DataHelper {
  constructor(
    private readonly dataSource: DataSource,
    private readonly app?: INestApplication
  ) {}

  async createTestUser(userData: TestUserData = {}): Promise<any> {
    const user = {
      ...DEFAULT_TEST_USER,
      password: bcrypt.hashSync(DEFAULT_TEST_USER.rawPassword, 10),
      created_at: new Date(),
      updated_at: new Date(),
      ...userData,
    };

    await this.dataSource
      .createQueryBuilder()
      .insert()
      .into("users")
      .values(user)
      .execute();

    return user;
  }

  async getAuthHeaders(): Promise<Record<string, string>> {
    if (!this.app) {
      throw new Error("App instance required for authentication");
    }

    const loginResponse = await request(this.app.getHttpServer())
      .post("/api/auth/login")
      .send({
        email: DEFAULT_TEST_USER.email,
        password: DEFAULT_TEST_USER.rawPassword,
      })
      .expect(200);

    const { success, data } = loginResponse.body;
    if (!success || !data.accessToken) {
      throw new Error("Login failed for test user");
    }

    return { Authorization: `Bearer ${data.accessToken}` };
  }

  getMockAuthHeaders(): Record<string, string> {
    return { Authorization: "Bearer mock-jwt-token" };
  }

  getInvalidAuthHeaders(): Record<string, string> {
    return { Authorization: "Bearer invalid-token" };
  }
}
