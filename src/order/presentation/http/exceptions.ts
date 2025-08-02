import { HttpException } from "@nestjs/common";

export class OrderNotFoundHttpError extends HttpException {
  constructor(orderId: string) {
    super(
      {
        statusCode: 404,
        message: "주문을 찾을 수 없습니다",
      },
      404
    );
  }
}
