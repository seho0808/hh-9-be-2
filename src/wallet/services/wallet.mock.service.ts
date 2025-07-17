import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from "@nestjs/common";
import {
  ChargeBalanceDto,
  BalanceResponseDto,
  ChargeResponseDto,
  TransactionResponseDto,
  TransactionQueryDto,
  TransactionType,
} from "../dto/wallet.dto";
import { PaginatedResponseDto } from "../../common/dto/response.dto";

interface MockBalance {
  userId: string;
  balance: number;
  updatedAt: Date;
}

interface MockTransaction {
  id: string;
  userId: string;
  type: TransactionType;
  amount: number;
  balanceAfter: number;
  reason?: string;
  referenceId?: string;
  createdAt: Date;
}

@Injectable()
export class WalletMockService {
  // Mock 잔액 데이터베이스
  private mockBalances: MockBalance[] = [
    {
      userId: "user-123",
      balance: 50000,
      updatedAt: new Date("2024-01-01"),
    },
    {
      userId: "admin-456",
      balance: 1000000,
      updatedAt: new Date("2024-01-01"),
    },
  ];

  // Mock 거래 내역 데이터베이스
  private mockTransactions: MockTransaction[] = [
    {
      id: "tx-1",
      userId: "user-123",
      type: TransactionType.CHARGE,
      amount: 50000,
      balanceAfter: 50000,
      reason: "초기 충전",
      createdAt: new Date("2024-01-01"),
    },
    {
      id: "tx-2",
      userId: "admin-456",
      type: TransactionType.CHARGE,
      amount: 1000000,
      balanceAfter: 1000000,
      reason: "관리자 초기 충전",
      createdAt: new Date("2024-01-01"),
    },
  ];

  private transactionIdCounter = 3;

  async getUserBalance(userId: string): Promise<BalanceResponseDto> {
    let userBalance = this.mockBalances.find((b) => b.userId === userId);

    if (!userBalance) {
      // 사용자 첫 조회 시 잔액 0으로 초기화
      userBalance = {
        userId,
        balance: 0,
        updatedAt: new Date(),
      };
      this.mockBalances.push(userBalance);
    }

    return {
      userId: userBalance.userId,
      balance: userBalance.balance,
      updatedAt: userBalance.updatedAt,
    };
  }

  async chargeBalance(
    userId: string,
    chargeDto: ChargeBalanceDto
  ): Promise<ChargeResponseDto> {
    const { amount } = chargeDto;

    // 충전 금액 유효성 검사
    if (amount % 10 !== 0) {
      throw new BadRequestException("충전 금액은 10원 단위여야 합니다");
    }

    let userBalance = this.mockBalances.find((b) => b.userId === userId);

    if (!userBalance) {
      userBalance = {
        userId,
        balance: 0,
        updatedAt: new Date(),
      };
      this.mockBalances.push(userBalance);
    }

    // 최대 보유 한도 체크
    const maxBalance = 10000000; // 천만원
    if (userBalance.balance + amount > maxBalance) {
      throw new BadRequestException("총 보유 가능 잔액을 초과할 수 없습니다");
    }

    // 잔액 업데이트
    userBalance.balance += amount;
    userBalance.updatedAt = new Date();

    // 거래 내역 생성
    const transaction: MockTransaction = {
      id: `tx-${this.transactionIdCounter++}`,
      userId,
      type: TransactionType.CHARGE,
      amount,
      balanceAfter: userBalance.balance,
      reason: "포인트 충전",
      createdAt: new Date(),
    };
    this.mockTransactions.push(transaction);

    return {
      amount,
      newBalance: userBalance.balance,
      transactionId: transaction.id,
      chargedAt: transaction.createdAt,
    };
  }

  async getTransactionHistory(
    userId: string,
    query: TransactionQueryDto
  ): Promise<PaginatedResponseDto<TransactionResponseDto>> {
    let userTransactions = this.mockTransactions.filter(
      (tx) => tx.userId === userId
    );

    // 거래 타입 필터
    if (query.type) {
      userTransactions = userTransactions.filter(
        (tx) => tx.type === query.type
      );
    }

    // 최신 순으로 정렬
    userTransactions.sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );

    // 페이지네이션
    const page = query.page || 1;
    const limit = query.limit || 10;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;

    const paginatedTransactions = userTransactions.slice(startIndex, endIndex);

    const responseTransactions: TransactionResponseDto[] =
      paginatedTransactions.map((tx) => ({
        id: tx.id,
        userId: tx.userId,
        type: tx.type,
        amount: tx.amount,
        balanceAfter: tx.balanceAfter,
        reason: tx.reason,
        referenceId: tx.referenceId,
        createdAt: tx.createdAt,
      }));

    return new PaginatedResponseDto(
      responseTransactions,
      userTransactions.length,
      page,
      limit
    );
  }

  // 주문 시스템에서 사용할 내부 메서드들 (실제로는 더 복잡한 로직 필요)
  async deductBalance(
    userId: string,
    amount: number,
    reason: string,
    referenceId?: string
  ): Promise<boolean> {
    const userBalance = this.mockBalances.find((b) => b.userId === userId);

    if (!userBalance || userBalance.balance < amount) {
      return false;
    }

    userBalance.balance -= amount;
    userBalance.updatedAt = new Date();

    const transaction: MockTransaction = {
      id: `tx-${this.transactionIdCounter++}`,
      userId,
      type: TransactionType.DEDUCT,
      amount,
      balanceAfter: userBalance.balance,
      reason,
      referenceId,
      createdAt: new Date(),
    };
    this.mockTransactions.push(transaction);

    return true;
  }

  async refundBalance(
    userId: string,
    amount: number,
    reason: string,
    referenceId?: string
  ): Promise<boolean> {
    let userBalance = this.mockBalances.find((b) => b.userId === userId);

    if (!userBalance) {
      userBalance = {
        userId,
        balance: 0,
        updatedAt: new Date(),
      };
      this.mockBalances.push(userBalance);
    }

    userBalance.balance += amount;
    userBalance.updatedAt = new Date();

    const transaction: MockTransaction = {
      id: `tx-${this.transactionIdCounter++}`,
      userId,
      type: TransactionType.REFUND,
      amount,
      balanceAfter: userBalance.balance,
      reason,
      referenceId,
      createdAt: new Date(),
    };
    this.mockTransactions.push(transaction);

    return true;
  }
}
