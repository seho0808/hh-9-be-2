import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { AppModule } from "../../src/app.module";
import * as request from "supertest";

export class TestHelper {
  static app: INestApplication;
  static moduleFixture: TestingModule;

  static async createTestApp(): Promise<INestApplication> {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    const app = moduleFixture.createNestApplication();

    // Apply same configuration as main.ts
    app.setGlobalPrefix("api");
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
        transformOptions: {
          enableImplicitConversion: true,
        },
      })
    );

    await app.init();
    this.app = app;
    this.moduleFixture = moduleFixture;

    return app;
  }

  static async closeTestApp(): Promise<void> {
    if (this.app) {
      await this.app.close();
    }
  }

  static getMockJwtToken(): string {
    return "mock-jwt-token";
  }

  static getAuthHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.getMockJwtToken()}`,
    };
  }
}
